"""One-time relative-link repair using the initial layout migration manifest."""
from pathlib import Path
from urllib.parse import unquote, quote
import json, os, re

root = Path(__file__).resolve().parents[2]
manifest = json.loads((root / 'evidence/reference-conversion/layout_migration.json').read_text(encoding='utf-8-sig'))
if manifest.get('markdown_links_repaired'):
    print('Initial migrated links already repaired; no changes made.')
    raise SystemExit(0)
mapping = {row['source']: row['target'] for row in manifest['files']}
source_by_target = {target: source for source, target in mapping.items()}
changed = 0
for path in root.rglob('*.md'):
    current = path.relative_to(root).as_posix()
    original = source_by_target.get(current, current)
    original_parent = (root / original).parent
    content = path.read_text(encoding='utf-8-sig')
    def replace(match):
        destination = match.group(1)
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', destination) or destination.startswith('#'):
            return match.group(0)
        raw, marker, fragment = destination.partition('#')
        old_abs = (original_parent / unquote(raw)).resolve()
        try:
            old_relative = old_abs.relative_to(root).as_posix()
        except ValueError:
            return match.group(0)
        new_relative = mapping.get(old_relative, old_relative)
        new_abs = root / new_relative
        result = quote(Path(os.path.relpath(new_abs, path.parent)).as_posix(), safe='/._-')
        if marker:
            result += '#' + fragment
        return '](' + result + ')'
    repaired = re.sub(r'\]\(([^)]+)\)', replace, content)
    # Keep converted-document source metadata portable.
    if repaired.startswith('---\n'):
        repaired = re.sub(r'(?m)^source: [A-Z]:[^\n]+$',
                          lambda m: 'source: ' + (path.with_suffix('.pdf').name if path.with_suffix('.pdf').exists() else m[0][8:]),
                          repaired)
    if repaired != content:
        path.write_text(repaired, encoding='utf-8')
        changed += 1
print(f'Repaired {changed} Markdown files using the recorded source-to-target map.')
manifest['markdown_links_repaired'] = True
(root / 'evidence/reference-conversion/layout_migration.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
