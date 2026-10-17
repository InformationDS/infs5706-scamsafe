"""Source preservation remains independent of mutable current documents."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('source_checker', ROOT / 'scripts/maintenance/check_preparation.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class SourceSnapshotTests(unittest.TestCase):
    def setUp(self):
        (ROOT / 'local').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'local')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.package_path = self.root / checker.PACKAGE
        self.package_path.parent.mkdir(parents=True)
        self.package = json.loads((ROOT / checker.PACKAGE).read_text(encoding='utf-8'))
        self.save_package()
        for name in self.package['sourceSnapshots'].values():
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)

    def save_package(self):
        self.package_path.write_text(json.dumps(self.package, ensure_ascii=False), encoding='utf-8')

    def test_current_document_edits_do_not_rewrite_historical_hashes(self):
        current = self.root / 'docs/product/PRD.md'
        current.parent.mkdir(parents=True)
        current.write_text('Current product rules can change.', encoding='utf-8')
        self.assertEqual(checker.check(self.root)['errors'], [])

    def test_changed_snapshot_is_rejected(self):
        snapshot = self.root / self.package['sourceSnapshots']['docs/product/PRD.md']
        snapshot.write_bytes(snapshot.read_bytes() + b'changed')
        self.assertEqual(checker.check(self.root)['status'], 'failed')
        self.assertTrue(any('Source changed' in error for error in checker.check(self.root)['errors']))

    def test_remapping_to_current_or_external_source_is_rejected(self):
        self.package['sourceSnapshots']['docs/product/PRD.md'] = '../outside.txt'
        self.save_package()
        result = checker.check(self.root)
        self.assertEqual(result['status'], 'failed')
        self.assertTrue(any('Unexpected source snapshot location' in error for error in result['errors']))

    def test_missing_snapshot_is_rejected(self):
        snapshot = self.root / self.package['sourceSnapshots']['docs/product/PRD.md']
        snapshot.unlink()
        self.assertEqual(checker.check(self.root)['status'], 'failed')


if __name__ == '__main__':
    unittest.main()
