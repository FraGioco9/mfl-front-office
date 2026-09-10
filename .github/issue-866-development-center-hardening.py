from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}")
    file_path.write_text(content.replace(old, new, 1), encoding="utf-8")


replace_once(
    "scripts/database/clubs.py",
    '''    rows = connection.execute(\n        """\n        SELECT DISTINCT active_contract_club_id\n        FROM players\n        WHERE coalesce(active_contract_club_id, '') <> ''\n          AND lower(trim(coalesce(active_contract_club_name, ''))) = 'development center'\n        """\n    ).fetchall()\n''',
    '''    rows = connection.execute(\n        """\n        SELECT active_contract_club_id\n        FROM players\n        WHERE coalesce(active_contract_club_id, '') <> ''\n        GROUP BY active_contract_club_id\n        HAVING SUM(\n            CASE\n                WHEN lower(trim(coalesce(active_contract_club_name, ''))) <> 'development center'\n                THEN 1\n                ELSE 0\n            END\n        ) = 0\n        """\n    ).fetchall()\n''',
)

marker = '''    def test_club_reuse_fails_if_current_players_reference_unknown_club(self) -> None:\n'''
new_test = '''    def test_club_reuse_does_not_ignore_mixed_development_center_reference(self) -> None:\n        with tempfile.TemporaryDirectory() as directory:\n            previous_path = Path(directory) / "previous.db"\n            previous = sqlite3.connect(previous_path)\n            clubs.ensure_club_schema(previous)\n            previous.execute(\n                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",\n                ("42", "Club", "", "", None, None, "FOUNDED", 2, "", "", "[]", "[]"),\n            )\n            previous.commit()\n            previous.close()\n\n            current = sqlite3.connect(":memory:")\n            try:\n                current.executescript(\n                    """\n                    CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);\n                    CREATE TABLE players (\n                        player_id INTEGER PRIMARY KEY,\n                        wallet_address TEXT,\n                        wallet_name TEXT,\n                        active_contract_club_id TEXT,\n                        active_contract_club_name TEXT\n                    );\n                    INSERT INTO players VALUES (1, '0xp', 'P', '100000', 'Development Center');\n                    INSERT INTO players VALUES (2, '0xp', 'P', '100000', 'Unexpected Club');\n                    """\n                )\n                with self.assertRaisesRegex(RuntimeError, "100000"):\n                    clubs.restore_previous_clubs(current, previous_path)\n            finally:\n                current.close()\n\n'''
replace_once("tests/test_database_refresh_controls.py", marker, new_test + marker)
