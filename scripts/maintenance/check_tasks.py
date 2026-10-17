"""Validate current task definitions, dependency graph and declared file inputs.

This is a documentation check. It never executes tasks or approves work.
"""
from pathlib import Path
import argparse
import json
import re
import sys


def check_parallel_plan(rows):
    """Check that module work is independent and has no shared write owner."""
    errors = []
    by_id = {row['id']: row for row in rows}
    modules = [row for row in rows if row.get('phase') == 'module']
    owners = {}
    module_ids = {row['id'] for row in modules}
    if {row['role'] for row in modules} != set('BCDE') or len(modules) != 4:
        errors.append('Parallel phase must have one module each for B, C, D and E')
    for row in modules:
        dependencies = row['dependencies']
        if len(dependencies) != 1 or by_id.get(dependencies[0], {}).get('phase') != 'prepare':
            errors.append(f'{row["id"]}: module must depend only on the common preparation task')
        for name in row['writes'] + row['creates']:
            if name in owners and owners[name] != row['id']:
                errors.append(f'Parallel write conflict: {name} ({owners[name]}, {row["id"]})')
            owners[name] = row['id']
    integrators = [row for row in rows if row.get('phase') == 'integrate']
    if len(integrators) != 1 or not module_ids.issubset(set(integrators[0]['dependencies'])):
        errors.append('Integration must wait for every parallel module')
    return errors


def check(root):
    errors = []
    registry = json.loads((root / 'docs/project/task-map.json').read_text(encoding='utf-8'))
    rows = registry['tasks']
    errors.extend(check_parallel_plan(rows))
    by_id = {row['id']: row for row in rows}
    if len(by_id) != len(rows):
        errors.append('Duplicate task ID')
    directory = root / 'docs/project/tasks'
    expected = {f'{key}.md' for key in by_id}
    actual = {p.name for p in directory.iterdir() if p.is_file()}
    if actual != expected:
        errors.append(f'Task directory differs from registry: {sorted(actual ^ expected)}')
    ancestors = {}

    def visit(key, stack):
        if key in stack:
            errors.append('Dependency cycle: ' + ' -> '.join([*stack, key]))
            return set()
        if key not in by_id:
            errors.append(f'Unknown dependency: {key}')
            return set()
        if key in ancestors:
            return ancestors[key]
        found = set()
        for dependency in by_id[key]['dependencies']:
            found.add(dependency)
            found.update(visit(dependency, [*stack, key]))
        ancestors[key] = found
        return found

    for key in by_id:
        visit(key, [])
    producers = {}
    for row in rows:
        for name in row['creates']:
            if name in producers:
                errors.append(f'Multiple creators: {name}')
            producers[name] = row['id']

    headings = ['目标与责任', '开工条件', '必读与固定输入', '允许修改与交付',
                '顺序步骤', '固定检查与预期', '停止、审核与完成条件', '工作包与交付门槛', '唯一执行记录']
    index = (root / 'docs/project/TASKS.md').read_text(encoding='utf-8')
    covered = set()
    for row in rows:
        key = row['id']
        if not re.fullmatch(r'[A-F]\d{2}', key) or row['role'] != key[0]:
            errors.append(f'Invalid task identity: {key}')
        path = directory / f'{key}.md'
        if not path.exists():
            continue
        text = path.read_text(encoding='utf-8')
        if f'(tasks/{key}.md)' not in index:
            errors.append(f'Task missing from entrypoint: {key}')
        for heading in headings:
            if f'## {heading}' not in text:
                errors.append(f'{key}: missing section {heading}')
        for dependency in row['dependencies']:
            if f']({dependency}.md)' not in text:
                errors.append(f'{key}: dependency not linked in card: {dependency}')
        if not row['dependencies'] and row.get('gate'):
            errors.append(f'{key}: inconsistent independent readiness')
        for name in row['reads'] + row['writes'] + row['creates']:
            target = (root / name).resolve()
            if not target.is_relative_to(root.resolve()):
                errors.append(f'{key}: path escapes project: {name}')
                continue
            if name in row['creates']:
                if f'`{name}`' not in text:
                    errors.append(f'{key}: new output is not explicit: {name}')
                continue
            if name in row['writes'] and f'`{name}`' not in text:
                errors.append(f'{key}: allowed write missing from card: {name}')
            if target.exists():
                continue
            producer = producers.get(name)
            if producer not in ancestors.get(key, set()):
                errors.append(f'{key}: missing input/write target without producer dependency: {name}')
        for requirement in row['requirements']:
            if not re.fullmatch(r'FR-(0[1-9]|1[0-2])', requirement):
                errors.append(f'{key}: unknown PRD requirement: {requirement}')
            if requirement not in text:
                errors.append(f'{key}: requirement missing in card: {requirement}')
            covered.add(requirement)
        if not re.search(r'^\|[^\n]+\|[^\n]+\|$', text, re.M):
            errors.append(f'{key}: no observable expectation table')
    missing = {f'FR-{n:02}' for n in range(1, 13)} - covered
    if missing:
        errors.append(f'PRD coverage missing: {sorted(missing)}')
    # Active instructions must not route agents to obsolete task identifiers/templates.
    stale = re.compile(r'TASK-\d{3}(?:-\d{2})?|tasks/TEMPLATE\.md')
    for folder in ['docs', 'app', 'server', 'shared', 'data', 'tests', '.github']:
        for path in (root / folder).rglob('*.md'):
            if stale.search(path.read_text(encoding='utf-8-sig')):
                errors.append(f'Obsolete task reference: {path.relative_to(root)}')
    for name in ['README.md', 'AGENTS.md', 'AI_START_HERE.md', 'CONTRIBUTING.md']:
        if stale.search((root / name).read_text(encoding='utf-8-sig')):
            errors.append(f'Obsolete task reference: {name}')
    return {'status': 'failed' if errors else 'passed', 'scope': 'Task definitions only; no implementation or acceptance execution',
            'taskCount': len(rows), 'independentInputs': [r['id'] for r in rows if not r['dependencies']],
            'requirementsCovered': sorted(covered), 'errors': errors}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[2]
    report = check(project)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report['status'] == 'passed' else 1)
