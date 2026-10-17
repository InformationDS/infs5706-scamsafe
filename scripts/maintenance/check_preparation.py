"""Validate the draft source package without claiming application readiness."""
from pathlib import Path
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = 'data/evaluation/baseline/T09.source.json'
SCOPES = {'role', 'input', 'correction', 'questionsAndAnswers', 'guidelines',
          'factualSummary', 'recommendations', 'handoverBodies'}
SEGMENTS = {'narrative', 'correction', 'answer1', 'answer2', 'summary', 'questions'}


def inside(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f'Path outside project: {relative}')
    return path


def check(root=ROOT):
    errors = []
    try:
        package = json.loads((root / PACKAGE).read_text(encoding='utf-8'))
        if (package['evaluationId'], package['caseId'], package['synthetic']) != ('T09', 'EXAMPLE-01', True):
            errors.append('Incorrect evaluation/case identity or synthetic marker')
        if set(package['approvals']) != SCOPES or any(v != 'pending' for v in package['approvals'].values()):
            errors.append('Source package must retain pending content approvals; it is not an approval registry')
        if set(package['sourceHashes']) != {
            'docs/product/examples/WORKED_CASE.md', 'docs/product/PRD.md',
            'docs/product/FIELD_DICTIONARY.md', 'data/evaluation/cases/T09.md',
            'data/evaluation/expected/T09.md', 'data/roles/EXAMPLE_ROLE_DRAFT.md',
            'data/guidelines/EXAMPLE_GUIDELINES_DRAFT.md'
        }:
            errors.append('Source inventory differs from the reviewed inputs')
        snapshots = package.get('sourceSnapshots', {})
        if set(snapshots) != set(package['sourceHashes']):
            errors.append('Exact source snapshots must cover the original source inventory')
        for relative, expected in package['sourceHashes'].items():
            snapshot = snapshots.get(relative, '')
            if snapshot != 'evidence/preparation/source-snapshot/' + relative + '.txt':
                errors.append(f'Unexpected source snapshot location: {relative}')
                continue
            if hashlib.sha256(inside(root, snapshot).read_bytes()).hexdigest() != expected:
                errors.append(f'Source changed; A must compare and reconfirm: {relative}')
        ids = [s['id'] for s in package['segments']]
        if len(ids) != len(SEGMENTS) or set(ids) != SEGMENTS:
            errors.append('Source segments missing or duplicated')
        for segment in package['segments']:
            source = inside(root, snapshots[segment['source']]).read_text(encoding='utf-8')
            if not segment['text'] or segment['text'] not in source:
                errors.append(f'Segment differs from source: {segment["id"]}')
        copied = {s['id']: s['text'] for s in package['segments']}
        for name, needles in {
            'narrative': ['09:00', '09:30', '2,000', 'SYN Telco B', 'not provided'],
            'correction': ['AUD 200, not AUD 2,000'],
            'answer1': ['The app says pending.'],
            'answer2': ['I do not know', 'I cannot identify'],
            'questions': ['E09 / TX-01', 'C08 / CONTACT-01', 'E08 / TX-01'],
            'summary': ['Insufficient approved guidance; human review required', 'one round of three questions']
        }.items():
            for needle in needles:
                if needle not in copied.get(name, ''):
                    errors.append(f'Missing fixed baseline detail: {name}: {needle}')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f'Cannot validate package: {exc}')
    return {
        'status': 'failed' if errors else 'passed',
        'scope': 'Draft source integrity only; no model, app, content approval or export verification',
        'package': PACKAGE,
        'errors': errors,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', help='Optional project-relative output report')
    args = parser.parse_args()
    result = check()
    if args.report:
        destination = inside(ROOT, args.report)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(1 if result['errors'] else 0)
