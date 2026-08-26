from __future__ import annotations

import unittest

from mfl_marketplace_runtime_state import RUNTIME_BUCKET, RUNTIME_OBJECT, runtime_payload


class MarketplaceRuntimeStateTests(unittest.TestCase):
    def test_runtime_payload_keeps_only_valid_listing_prices(self) -> None:
        payload = runtime_payload(
            {
                "generated_at": "2026-08-26T00:00:00Z",
                "source": "flow-mainnet-nftstorefront-events",
                "flow_block_height": 123456,
                "players": {
                    "42": {"listing_price": "125.50000000"},
                    "43": {"listing_price": "0.00000000"},
                    "invalid": {"listing_price": "50"},
                    "44": {"listing_price": "not-a-price"},
                    "45": None,
                },
            }
        )

        self.assertEqual(payload["schema_version"], 1)
        self.assertEqual(payload["generated_at"], "2026-08-26T00:00:00Z")
        self.assertEqual(payload["flow_block_height"], 123456)
        self.assertEqual(payload["listed_player_count"], 2)
        self.assertEqual(
            payload["prices"],
            {"42": "125.50000000", "43": "0.00000000"},
        )

    def test_runtime_location_is_stable(self) -> None:
        self.assertEqual(RUNTIME_BUCKET, "mfl-runtime")
        self.assertEqual(RUNTIME_OBJECT, "marketplace/listings.json")

    def test_runtime_payload_requires_timestamp_and_player_map(self) -> None:
        with self.assertRaises(ValueError):
            runtime_payload({"generated_at": "", "players": {}})
        with self.assertRaises(ValueError):
            runtime_payload({"generated_at": "2026-08-26T00:00:00Z", "players": []})


if __name__ == "__main__":
    unittest.main()
