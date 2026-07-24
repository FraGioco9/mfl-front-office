import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from candidate_only_rebuild import install_candidate_only_rebuild


class CandidateOnlyRebuildTests(unittest.TestCase):
    def test_final_replace_keeps_both_files_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            candidate = root / "candidate.db"
            database = root / "active.db"
            candidate.write_bytes(b"candidate")
            database.write_bytes(b"active")

            output = Mock()
            module = SimpleNamespace(
                os=__import__("os"),
                print=output,
                CANDIDATE_PATH=candidate,
                DATABASE_PATH=database,
            )
            install_candidate_only_rebuild(module)

            module.os.replace(candidate, database)
            module.print(f"Flow database rebuild complete: {database}", flush=True)

            self.assertEqual(candidate.read_bytes(), b"candidate")
            self.assertEqual(database.read_bytes(), b"active")
            output.assert_any_call(f"Candidate ready: {candidate}", flush=True)
            output.assert_any_call(f"Current database unchanged: {database}", flush=True)

    def test_other_os_attributes_remain_available(self):
        module = SimpleNamespace(
            os=__import__("os"),
            print=Mock(),
            CANDIDATE_PATH=Path("candidate.db"),
            DATABASE_PATH=Path("active.db"),
        )
        install_candidate_only_rebuild(module)
        self.assertTrue(callable(module.os.path.exists))


if __name__ == "__main__":
    unittest.main()
