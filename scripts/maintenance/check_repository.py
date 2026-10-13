"""Read-only checks for project documents and migrated reference files."""
from pathlib import Path
from urllib.parse import unquote
import argparse, ast, hashlib, json, re, sys
from datetime import datetime, timezone

def check(root):
    errors=[]
    link_count=0
    documents=0
    for path in root.rglob('*.md'):
        if any(part in {'local','.git','node_modules','.venv','__pycache__'} for part in path.relative_to(root).parts):
            continue
        documents+=1
        text=path.read_text(encoding='utf-8-sig')
        text=re.sub(r'```.*?```','',text,flags=re.S)
        for destination in re.findall(r'\]\(([^)]+)\)',text):
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:',destination) or destination.startswith('#'):
                continue
            decoded=unquote(destination.split('#')[0].strip('<>'))
            target=(path.parent/decoded).resolve()
            link_count+=1
            if not target.exists():
                errors.append(f'Broken link: {path.relative_to(root)} -> {destination}')
    dictionary=(root/'docs/product/FIELD_DICTIONARY.md').read_text(encoding='utf-8')
    ids=re.findall(r'^\| ([A-P]\d{2}) \|',dictionary,re.M)
    if len(ids)!=117 or len(set(ids))!=117:
        errors.append(f'Field definitions: expected 117 unique IDs, found {len(ids)} / {len(set(ids))}')
    for line in dictionary.splitlines():
        if re.match(r'^\| [A-P]\d{2} \|',line) and len(line.split('|'))!=7:
            errors.append(f'Malformed field row: {line[:80]}')
    for relative,count in [('references/assignment/Assessment_Guide.md',9),('references/accc/Targeting_Scams_2025.md',49)]:
        text=(root/relative).read_text(encoding='utf-8')
        pages=[int(p) for p in re.findall(r'<!-- page (\d+) -->',text)]
        if pages!=list(range(1,count+1)):
            errors.append(f'Unexpected page markers: {relative}')
    pictures=list((root/'references/accc/assets/pages').glob('page-*.png'))
    if len(pictures)!=49:
        errors.append(f'Expected 49 ACCC page images, found {len(pictures)}')
    migration=json.loads((root/'evidence/reference-conversion/layout_migration.json').read_text(encoding='utf-8-sig'))
    removals_path=root/'evidence/reference-conversion/user_requested_removals.json'
    removals=json.loads(removals_path.read_text(encoding='utf-8-sig')) if removals_path.exists() else {'removed_files':[]}
    removed_paths={row['path'] for row in removals['removed_files']}
    for removed in removed_paths:
        if (root/removed).exists():
            errors.append(f'User-requested deletion reappeared: {removed}')
    originals=0
    optional_local=0
    for row in migration['files']:
        path=root/row['target']
        if row['target'] in removed_paths:
            continue
        if row['target'].startswith('local/'):
            if path.exists():
                optional_local+=1
                if hashlib.sha256(path.read_bytes()).hexdigest().upper()!=row['sha256_at_move'].upper():
                    errors.append(f'Local archived file hash mismatch: {row["target"]}')
            continue
        if not path.exists():
            errors.append(f'Migrated file missing: {row["target"]}')
            continue
        if path.suffix.lower() in {'.pdf','.png','.html'}:
            originals+=1
            if hashlib.sha256(path.read_bytes()).hexdigest().upper()!=row['sha256_at_move'].upper():
                errors.append(f'Original reference hash mismatch: {row["target"]}')
    python_files=list((root/'scripts').rglob('*.py'))
    for path in python_files:
        try:
            ast.parse(path.read_text(encoding='utf-8'),filename=str(path))
        except SyntaxError as exc:
            errors.append(f'Script syntax: {path.relative_to(root)}: {exc}')
    return dict(status='passed' if not errors else 'failed',markdown_documents=documents,local_links=link_count,
                field_definitions=len(ids),accc_page_images=len(pictures),preserved_original_files=originals,
                migrated_files=len(migration['files']),authorized_removed_files=len(removed_paths),optional_local_archives_present=optional_local,
                python_scripts_parsed=len(python_files),errors=errors,
                scope='Repository documents/source preservation; no application tests',
                recorded_at_utc=datetime.now(timezone.utc).isoformat(),initial_reorganization_date='2026-10-13')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report',help='Optional repository-relative JSON output path')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[2]
    result=check(root)
    if args.report:
        destination=(root/args.report).resolve()
        if not destination.is_relative_to(root):
            parser.error('Report must be inside the project')
        destination.parent.mkdir(parents=True,exist_ok=True)
        destination.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['status']=='passed' else 1)
