import sqlite3
import unittest

from flow_data import decode_cadence
from next_overall import next_overall_target, next_overall_values
from progression_rebuild import progression_value


class RebuildPipelineTests(unittest.TestCase):
    def test_decode_cadence_dictionary_and_optional(self):
        node = {
            "type": "Dictionary",
            "value": [
                {
                    "key": {"type": "String", "value": "overall"},
                    "value": {"type": "Optional", "value": {"type": "UInt32", "value": "85"}},
                },
                {
                    "key": {"type": "String", "value": "positions"},
                    "value": {
                        "type": "Array",
                        "value": [{"type": "String", "value": "ST"}],
                    },
                },
            ],
        }
        self.assertEqual(decode_cadence(node), {"overall": 85, "positions": ["ST"]})

    def test_progression_missing_values_become_zero(self):
        self.assertEqual(progression_value(None, "overall"), 0)
        self.assertEqual(progression_value({"overall": "7"}, "overall"), 7)

    def test_next_overall_target_matches_existing_logic(self):
        self.assertEqual(next_overall_target(85, 85.2), 85.5)

    def test_next_overall_values_for_striker(self):
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        connection.execute(
            "CREATE TABLE test (positions TEXT, overall INTEGER, pace INTEGER, shooting INTEGER, passing INTEGER, dribbling INTEGER, defense INTEGER, physical INTEGER, goalkeeping INTEGER)"
        )
        connection.execute("INSERT INTO test VALUES ('ST', 80, 80, 80, 80, 80, 80, 80, 0)")
        row = connection.execute("SELECT * FROM test").fetchone()
        values = next_overall_values(row)
        self.assertEqual(values[0], 80.0)
        self.assertEqual(values[1], 0.5)
        self.assertIsNotNone(values[3])


if __name__ == "__main__":
    unittest.main()
