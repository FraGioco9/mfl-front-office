import base64
import json
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

import mfl_marketplace_events as events
from mfl_marketplace_snapshot import Listing


def cdc_value(type_name: str, value: object) -> dict[str, object]:
    return {"type": type_name, "value": value}


def cdc_type(type_id: str) -> dict[str, object]:
    return {
        "type": "Type",
        "value": {
            "staticType": {
                "kind": "Resource",
                "type": "",
                "typeID": type_id,
                "fields": [],
                "initializers": [],
            }
        },
    }


def event_payload(**fields: dict[str, object]) -> dict[str, object]:
    return {
        "type": "Event",
        "value": {
            "id": "A.test.Event",
            "fields": [{"name": name, "value": value} for name, value in fields.items()],
        },
    }


class MarketplaceEventTests(unittest.TestCase):
    def test_event_types_cover_v1_and_v2(self) -> None:
        self.assertIn("NFTStorefront.ListingAvailable", events.EVENT_TYPES["v1_available"])
        self.assertIn("NFTStorefront.ListingCompleted", events.EVENT_TYPES["v1_completed"])
        self.assertIn("NFTStorefrontV2.ListingAvailable", events.EVENT_TYPES["v2_available"])
        self.assertIn("NFTStorefrontV2.ListingCompleted", events.EVENT_TYPES["v2_completed"])

    def test_decode_event_payload(self) -> None:
        payload = event_payload(value=cdc_value("UInt64", "42"))
        encoded = base64.b64encode(json.dumps(payload).encode()).decode()
        self.assertEqual(events.decode_event_payload(encoded), payload)

    def test_parse_v1_available(self) -> None:
        payload = event_payload(
            storefrontAddress=cdc_value("Address", "0xaaaaaaaaaaaaaaaa"),
            listingResourceID=cdc_value("UInt64", "77"),
            nftType=cdc_type("A.8ebcbfd516b1da27.MFLPlayer.NFT"),
            nftID=cdc_value("UInt64", "123"),
            price=cdc_value("UFix64", "149.50000000"),
        )
        event = events.OrderedFlowEvent(1, 0, 0, events.EVENT_TYPES["v1_available"], payload)
        listing = events.parse_available_listing(event)
        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.player_id, 123)
        self.assertEqual(listing.price, Decimal("149.50000000"))
        self.assertEqual(listing.storefront_version, "v1")

    def test_apply_available_then_completed(self) -> None:
        available_payload = event_payload(
            storefrontAddress=cdc_value("Address", "0xaaaaaaaaaaaaaaaa"),
            listingResourceID=cdc_value("UInt64", "77"),
            nftType=cdc_type("A.8ebcbfd516b1da27.MFLPlayer.NFT"),
            nftID=cdc_value("UInt64", "123"),
            salePrice=cdc_value("UFix64", "99.00000000"),
        )
        completed_payload = event_payload(
            listingResourceID=cdc_value("UInt64", "77"),
            nftType=cdc_type("A.8ebcbfd516b1da27.MFLPlayer.NFT"),
            nftID=cdc_value("UInt64", "123"),
        )
        active = {}
        applied = events.apply_events(
            active,
            [
                events.OrderedFlowEvent(1, 0, 0, events.EVENT_TYPES["v2_available"], available_payload),
                events.OrderedFlowEvent(2, 0, 0, events.EVENT_TYPES["v2_completed"], completed_payload),
            ],
        )
        self.assertEqual(applied, 2)
        self.assertEqual(active, {})

    def test_non_mfl_event_is_ignored(self) -> None:
        payload = event_payload(
            storefrontAddress=cdc_value("Address", "0xaaaaaaaaaaaaaaaa"),
            listingResourceID=cdc_value("UInt64", "77"),
            nftType=cdc_type("A.0000000000000001.Other.NFT"),
            nftID=cdc_value("UInt64", "123"),
            price=cdc_value("UFix64", "1.00000000"),
        )
        event = events.OrderedFlowEvent(1, 0, 0, events.EVENT_TYPES["v1_available"], payload)
        self.assertIsNone(events.parse_available_listing(event))

    def test_state_round_trip_and_lowest_price(self) -> None:
        active = {
            "v1:1": Listing(42, Decimal("150.00000000"), "0xaaaaaaaaaaaaaaaa", 1, "v1"),
            "v2:2": Listing(42, Decimal("125.00000000"), "0xbbbbbbbbbbbbbbbb", 2, "v2"),
        }
        state = events.build_state(
            active,
            block_height=100,
            mode="incremental",
            processed_event_count=3,
        )
        self.assertEqual(state["players"]["42"]["listing_price"], "125.00000000")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            events.write_state(state, path)
            loaded = events.load_state(path)
            restored = events.active_from_snapshot(loaded)
        self.assertEqual(restored, active)


if __name__ == "__main__":
    unittest.main()
