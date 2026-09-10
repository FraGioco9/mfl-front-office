from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}")
    file_path.write_text(content.replace(old, new, 1), encoding="utf-8")


clubs_path = "scripts/database/clubs.py"

replace_once(
    clubs_path,
    '''    return dict(grouped)\n\n\ndef build_club_record(\n''',
    '''    return dict(grouped)\n\n\ndef development_center_club_ids(connection: sqlite3.Connection) -> set[str]:\n    """Return pseudo-club IDs used only to mark Development Center contracts."""\n    player_columns = {\n        str(row[1])\n        for row in connection.execute("PRAGMA table_info(players)").fetchall()\n    }\n    if "active_contract_club_name" not in player_columns:\n        return set()\n    rows = connection.execute(\n        """\n        SELECT DISTINCT active_contract_club_id\n        FROM players\n        WHERE coalesce(active_contract_club_id, '') <> ''\n          AND lower(trim(coalesce(active_contract_club_name, ''))) = 'development center'\n        """\n    ).fetchall()\n    return {str(row[0]) for row in rows}\n\n\ndef build_club_record(\n''',
)

replace_once(
    clubs_path,
    '''    missing_referenced_clubs = sorted(\n        set(signed_players) - existing_club_ids,\n        key=lambda value: (0, int(value)) if value.isdigit() else (1, value),\n    )\n''',
    '''    non_persisted_club_ids = development_center_club_ids(connection)\n    missing_referenced_clubs = sorted(\n        set(signed_players) - existing_club_ids - non_persisted_club_ids,\n        key=lambda value: (0, int(value)) if value.isdigit() else (1, value),\n    )\n''',
)


tests_path = "tests/test_database_refresh_controls.py"
marker = '''    def test_club_reuse_fails_if_current_players_reference_unknown_club(self) -> None:\n'''
new_test = '''    def test_club_reuse_allows_development_center_pseudo_club_without_club_row(self) -> None:\n        with tempfile.TemporaryDirectory() as directory:\n            previous_path = Path(directory) / "previous.db"\n            previous = sqlite3.connect(previous_path)\n            clubs.ensure_club_schema(previous)\n            previous.execute(\n                "INSERT INTO clubs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",\n                ("42", "Club", "", "", None, None, "FOUNDED", 2, "", "", "[]", "[]"),\n            )\n            previous.commit()\n            previous.close()\n\n            current = sqlite3.connect(":memory:")\n            try:\n                current.executescript(\n                    """\n                    CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);\n                    CREATE TABLE players (\n                        player_id INTEGER PRIMARY KEY,\n                        wallet_address TEXT,\n                        wallet_name TEXT,\n                        active_contract_club_id TEXT,\n                        active_contract_club_name TEXT\n                    );\n                    INSERT INTO players VALUES (1, '0xp', 'P', '42', 'Club');\n                    INSERT INTO players VALUES (2, '0xp', 'P', '100000', 'Development Center');\n                    """\n                )\n                count = clubs.restore_previous_clubs(current, previous_path)\n                self.assertEqual(count, 1)\n                signed = current.execute(\n                    "SELECT signed_player_ids FROM clubs WHERE club_id = '42'"\n                ).fetchone()[0]\n                self.assertEqual(json.loads(signed), [1])\n                self.assertEqual(\n                    clubs.development_center_club_ids(current),\n                    {"100000"},\n                )\n            finally:\n                current.close()\n\n'''
replace_once(tests_path, marker, new_test + marker)
