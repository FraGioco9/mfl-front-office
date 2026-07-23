import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from windows_database_replace import (
    DATABASE_REPLACE_RETRIES,
    DATABASE_REPLACE_RETRY_DELAY_SECONDS,
    install_database_replace_retry,
    replace_with_retries,
)


class WindowsDatabaseReplaceTests(unittest.TestCase):
    def test_retries_transient_lock_then_replaces(self):
        locked = PermissionError(13, "locked")
        setattr(locked, "winerror", 32)
        replace = Mock(side_effect=[locked, locked, None])

        with patch("windows_database_replace.time.sleep") as sleep:
            replace_with_retries("candidate.db", "active.db", replace=replace)

        self.assertEqual(replace.call_count, 3)
        self.assertEqual(sleep.call_count, 2)
        sleep.assert_called_with(DATABASE_REPLACE_RETRY_DELAY_SECONDS)

    def test_persistent_lock_has_clear_error(self):
        locked = PermissionError(13, "locked")
        setattr(locked, "winerror", 32)
        replace = Mock(side_effect=locked)

        with patch("windows_database_replace.time.sleep"):
            with self.assertRaisesRegex(RuntimeError, "Database is still locked"):
                replace_with_retries("candidate.db", "active.db", replace=replace)

        self.assertEqual(replace.call_count, DATABASE_REPLACE_RETRIES + 1)

    def test_non_lock_error_is_not_retried(self):
        replace = Mock(side_effect=FileNotFoundError("missing"))

        with patch("windows_database_replace.time.sleep") as sleep:
            with self.assertRaises(FileNotFoundError):
                replace_with_retries("candidate.db", "active.db", replace=replace)

        replace.assert_called_once()
        sleep.assert_not_called()

    def test_install_wraps_only_replace(self):
        original_replace = Mock()
        original_os = SimpleNamespace(replace=original_replace, path="path-value")
        rebuild_module = SimpleNamespace(os=original_os)

        install_database_replace_retry(rebuild_module)
        rebuild_module.os.replace("candidate.db", "active.db")

        original_replace.assert_called_once_with("candidate.db", "active.db")
        self.assertEqual(rebuild_module.os.path, "path-value")


if __name__ == "__main__":
    unittest.main()
