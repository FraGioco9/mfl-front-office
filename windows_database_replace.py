from __future__ import annotations

import time
from pathlib import Path
from types import ModuleType
from typing import Any, Callable

DATABASE_REPLACE_RETRIES = 12
DATABASE_REPLACE_RETRY_DELAY_SECONDS = 5
RETRYABLE_WINDOWS_ERRORS = {5, 32}


def is_retryable_file_lock(error: OSError) -> bool:
    return isinstance(error, PermissionError) or getattr(error, "winerror", None) in RETRYABLE_WINDOWS_ERRORS


def replace_with_retries(
    source: str | bytes | Path,
    destination: str | bytes | Path,
    *,
    replace: Callable[[Any, Any], None],
    retries: int = DATABASE_REPLACE_RETRIES,
    delay_seconds: float = DATABASE_REPLACE_RETRY_DELAY_SECONDS,
) -> None:
    for retry in range(retries + 1):
        try:
            replace(source, destination)
            return
        except OSError as error:
            if not is_retryable_file_lock(error) or retry == retries:
                if is_retryable_file_lock(error):
                    raise RuntimeError(
                        "Database is still locked. Close the site, SQLite tools, and OneDrive access, "
                        "then promote the retained candidate."
                    ) from error
                raise

            print(f"DB locked; retry {retry + 1}/{retries} in {delay_seconds:g}s", flush=True)
            time.sleep(delay_seconds)


def install_database_replace_retry(rebuild_module: ModuleType) -> None:
    original_os = rebuild_module.os
    original_replace = original_os.replace

    class OSProxy:
        def __getattr__(self, name: str) -> Any:
            return getattr(original_os, name)

        @staticmethod
        def replace(source: Any, destination: Any) -> None:
            replace_with_retries(source, destination, replace=original_replace)

    rebuild_module.os = OSProxy()
