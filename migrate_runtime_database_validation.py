from __future__ import annotations

from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label} fragment, found {count}")
    return source.replace(old, new, 1)


def write_if_changed(path: Path, original: str, updated: str) -> None:
    if original == updated:
        print(f"Unchanged {path}")
        return
    path.write_text(updated, encoding="utf-8")
    print(f"Migrated {path}")


path = Path("prepare_runtime_database.py")
original = path.read_text(encoding="utf-8").replace("\r\n", "\n")
source = original

source = replace_once(
    source,
    'EXCLUDED_WALLET_NAMES = ("mfl", "mfl wallet", "mfl trade")\n',
    '''EXCLUDED_WALLET_NAMES = ("mfl", "mfl wallet", "mfl trade")\nRUNTIME_TABLES = frozenset({\n    "runtime_player_search",\n    "runtime_agents",\n    "runtime_clubs",\n    "runtime_database_stats",\n    "runtime_metadata",\n})\n''',
    "runtime table contract",
)

old_required_tables = '''def required_tables(connection: sqlite3.Connection) -> None:\n    tables = {\n        str(row[0])\n        for row in connection.execute(\n            "SELECT name FROM sqlite_master WHERE type = 'table'"\n        ).fetchall()\n    }\n    missing = {"players", "wallets"} - tables\n    if missing:\n        raise RuntimeError(f"Database is missing required table(s): {', '.join(sorted(missing))}")\n\n\n'''
new_validation_contract = '''def table_names(connection: sqlite3.Connection) -> set[str]:\n    return {\n        str(row[0])\n        for row in connection.execute(\n            "SELECT name FROM sqlite_master WHERE type = 'table'"\n        ).fetchall()\n    }\n\n\ndef required_tables(connection: sqlite3.Connection) -> None:\n    missing = {"players", "wallets"} - table_names(connection)\n    if missing:\n        raise RuntimeError(f"Database is missing required table(s): {', '.join(sorted(missing))}")\n\n\ndef validate_runtime_connection(connection: sqlite3.Connection) -> str:\n    """Validate the prepared runtime schema without changing the database."""\n    required_tables(connection)\n    missing = RUNTIME_TABLES - table_names(connection)\n    if missing:\n        raise RuntimeError(\n            f"Database is missing runtime table(s): {', '.join(sorted(missing))}"\n        )\n\n    generated_at_row = connection.execute(\n        "SELECT value FROM runtime_metadata WHERE key = 'generated_at' LIMIT 1"\n    ).fetchone()\n    generated_at = str(generated_at_row[0] if generated_at_row else "").strip()\n    if not generated_at:\n        raise RuntimeError("Runtime database is missing runtime_metadata generated_at")\n    try:\n        parsed = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))\n    except ValueError as error:\n        raise RuntimeError(\n            f"Runtime database has invalid generated_at: {generated_at}"\n        ) from error\n    if parsed.tzinfo is None:\n        raise RuntimeError(\n            f"Runtime database generated_at must include a timezone: {generated_at}"\n        )\n    return generated_at\n\n\ndef validate_runtime_database(database_path: Path) -> str:\n    """Open an already-prepared runtime database read-only and validate its contract."""\n    if not database_path.is_file():\n        raise FileNotFoundError(f"Database not found: {database_path}")\n\n    database_uri = f"{database_path.resolve().as_uri()}?mode=ro"\n    connection = sqlite3.connect(database_uri, uri=True)\n    try:\n        return validate_runtime_connection(connection)\n    finally:\n        connection.close()\n\n\n'''
source = replace_once(source, old_required_tables, new_validation_contract, "runtime validation helpers")

source = replace_once(
    source,
    '''        connection.commit()\n        connection.execute("ANALYZE")\n        connection.execute("PRAGMA optimize")\n        connection.commit()\n''',
    '''        connection.commit()\n        connection.execute("ANALYZE")\n        connection.execute("PRAGMA optimize")\n        connection.commit()\n        validate_runtime_connection(connection)\n''',
    "post-preparation validation",
)

source = replace_once(
    source,
    '''    parser.add_argument(\n        "database",\n        nargs="?",\n        default="mfl_database.db",\n        type=Path,\n        help="Path to the SQLite database (default: mfl_database.db).",\n    )\n    args = parser.parse_args()\n    database_path = args.database.resolve()\n    prepare_runtime_database(database_path)\n    size_mb = database_path.stat().st_size / (1024 * 1024)\n    print(f"Prepared runtime SQLite database: {database_path} ({size_mb:.1f} MB)")\n    return 0\n''',
    '''    parser.add_argument(\n        "database",\n        nargs="?",\n        default="mfl_database.db",\n        type=Path,\n        help="Path to the SQLite database (default: mfl_database.db).",\n    )\n    parser.add_argument(\n        "--validate-only",\n        action="store_true",\n        help="Validate an already-prepared runtime database without modifying it.",\n    )\n    args = parser.parse_args()\n    database_path = args.database.resolve()\n    if args.validate_only:\n        generated_at = validate_runtime_database(database_path)\n        size_mb = database_path.stat().st_size / (1024 * 1024)\n        print(\n            f"Validated runtime SQLite database: {database_path} "\n            f"({size_mb:.1f} MB, generatedAt {generated_at})"\n        )\n        return 0\n\n    prepare_runtime_database(database_path)\n    size_mb = database_path.stat().st_size / (1024 * 1024)\n    print(f"Prepared runtime SQLite database: {database_path} ({size_mb:.1f} MB)")\n    return 0\n''',
    "runtime database CLI",
)

for required in [
    "RUNTIME_TABLES = frozenset({",
    "def validate_runtime_connection(connection: sqlite3.Connection) -> str:",
    "def validate_runtime_database(database_path: Path) -> str:",
    "mode=ro",
    '"--validate-only"',
    "validate_runtime_connection(connection)",
]:
    if required not in source:
        raise RuntimeError(f"Runtime database validation contract is missing: {required}")

write_if_changed(path, original, source)
