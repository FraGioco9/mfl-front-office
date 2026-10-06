from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.database.checkpoint_manifest import create_manifest, verify_manifest


class CheckpointManifestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.database = self.root / "mfl_database.db"
        self.manifest = self.root / "checkpoint-manifest.json"
        connection = sqlite3.connect(self.database)
        try:
            connection.executescript(
                """
                CREATE TABLE players (player_id INTEGER PRIMARY KEY, name TEXT);
                CREATE TABLE wallets (wallet_address TEXT PRIMARY KEY, name TEXT);
                CREATE TABLE runtime_metadata (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL
                ) WITHOUT ROWID;
                INSERT INTO players(player_id, name) VALUES (1, 'Player One');
                INSERT INTO wallets(wallet_address, name) VALUES ('0xabc', 'Agent');
                INSERT INTO runtime_metadata(key, value) VALUES
                  ('generated_at', '2026-10-06T10:00:00.000Z'),
                  ('row_count', '1'),
                  ('wallet_count', '1'),
                  ('database_stats_contract', 'ownership-addresses-v1');
                """
            )
            connection.commit()
        finally:
            connection.close()

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def test_create_and_verify_records_content_and_schema_fingerprints(self) -> None:
        manifest = create_manifest(
            self.database,
            self.manifest,
            stage="core",
            run_id="1234",
            run_attempt="2",
        )
        self.assertEqual(manifest["manifestVersion"], 1)
        self.assertEqual(manifest["stage"], "core")
        self.assertEqual(manifest["runId"], "1234")
        self.assertEqual(len(manifest["sha256"]), 64)
        self.assertEqual(len(manifest["schemaSha256"]), 64)
        self.assertEqual(manifest["generatedAt"], "2026-10-06T10:00:00.000Z")
        self.assertEqual(manifest["rowCount"], "1")
        self.assertEqual(manifest["walletCount"], "1")
        self.assertGreater(manifest["sizeBytes"], 0)

        verified = verify_manifest(
            self.database,
            self.manifest,
            expected_stage="core",
            expected_run_id="1234",
        )
        self.assertEqual(verified["sha256"], manifest["sha256"])

    def test_missing_or_wrong_identity_fails_closed(self) -> None:
        create_manifest(
            self.database,
            self.manifest,
            stage="final",
            run_id="1234",
            run_attempt="1",
        )
        with self.assertRaisesRegex(RuntimeError, "does not match"):
            verify_manifest(self.database, self.manifest, expected_stage="core")
        with self.assertRaisesRegex(RuntimeError, "does not match"):
            verify_manifest(self.database, self.manifest, expected_run_id="9999")
        self.manifest.unlink()
        with self.assertRaisesRegex(RuntimeError, "does not exist"):
            verify_manifest(self.database, self.manifest)

    def test_database_mutation_after_manifest_is_rejected(self) -> None:
        create_manifest(
            self.database,
            self.manifest,
            stage="player_data",
            run_id="1234",
            run_attempt="1",
        )
        connection = sqlite3.connect(self.database)
        try:
            connection.execute("INSERT INTO players(player_id, name) VALUES (2, 'Player Two')")
            connection.commit()
        finally:
            connection.close()
        with self.assertRaisesRegex(RuntimeError, "manifest mismatch"):
            verify_manifest(self.database, self.manifest)

    def test_schema_mutation_after_manifest_is_rejected(self) -> None:
        create_manifest(
            self.database,
            self.manifest,
            stage="player_seasons",
            run_id="1234",
            run_attempt="1",
        )
        connection = sqlite3.connect(self.database)
        try:
            connection.execute("CREATE INDEX players_name_idx ON players(name)")
            connection.commit()
        finally:
            connection.close()
        with self.assertRaisesRegex(RuntimeError, "manifest mismatch"):
            verify_manifest(self.database, self.manifest)

    def test_corrupt_database_is_rejected_by_integrity_check(self) -> None:
        create_manifest(
            self.database,
            self.manifest,
            stage="final",
            run_id="1234",
            run_attempt="1",
        )
        data = bytearray(self.database.read_bytes())
        # Damage the SQLite header rather than relying on a content-only checksum failure.
        data[0:16] = b"not-a-sqlite-db!"
        self.database.write_bytes(data)
        with self.assertRaises((RuntimeError, sqlite3.DatabaseError)):
            verify_manifest(self.database, self.manifest)

    def test_manifest_tampering_is_rejected(self) -> None:
        create_manifest(
            self.database,
            self.manifest,
            stage="core",
            run_id="1234",
            run_attempt="1",
        )
        value = json.loads(self.manifest.read_text(encoding="utf-8"))
        value["sha256"] = "0" * 64
        self.manifest.write_text(json.dumps(value), encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "sha256"):
            verify_manifest(self.database, self.manifest)


if __name__ == "__main__":
    unittest.main()
