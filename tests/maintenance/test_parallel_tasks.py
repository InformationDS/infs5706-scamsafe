"""Reject schedules that reintroduce peer waiting or concurrent file ownership."""
from pathlib import Path
import copy
import importlib.util
import json
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('task_checker', ROOT / 'scripts/maintenance/check_tasks.py')
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


class ParallelPlanTests(unittest.TestCase):
    def setUp(self):
        self.rows = json.loads((ROOT / 'docs/project/task-map.json').read_text(encoding='utf-8'))['tasks']

    def test_current_plan_is_parallel(self):
        self.assertEqual([], CHECKER.check_parallel_plan(self.rows))

    def test_peer_dependency_is_rejected(self):
        rows = copy.deepcopy(self.rows)
        next(row for row in rows if row['role'] == 'E')['dependencies'].append('B01')
        self.assertTrue(any('common preparation' in e for e in CHECKER.check_parallel_plan(rows)))

    def test_shared_write_is_rejected(self):
        rows = copy.deepcopy(self.rows)
        b = next(row for row in rows if row['role'] == 'B')
        c = next(row for row in rows if row['role'] == 'C')
        c['writes'].append(b['writes'][0])
        self.assertTrue(any('Parallel write conflict' in e for e in CHECKER.check_parallel_plan(rows)))

    def test_missing_module_at_integration_is_rejected(self):
        rows = copy.deepcopy(self.rows)
        next(row for row in rows if row.get('phase') == 'integrate')['dependencies'].remove('E01')
        self.assertTrue(any('Integration must wait' in e for e in CHECKER.check_parallel_plan(rows)))


if __name__ == '__main__':
    unittest.main()
