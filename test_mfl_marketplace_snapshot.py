import sqlite3
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

import mfl_marketplace_snapshot as marketplace
from mfl_marketplace_cadence import PLAYER_LISTINGS_PAGE_SCRIPT


def cadence_listing(
    player_id: int,
    price: str,
    resource_id: int,
    version: str,
) -> dict[str, object]:
    return {
        "type": "Struct",
        "value": {
            "id": "A.test.PlayerListing",
            "fields": [
                {
                    "name": "playerId",
                    "value": {"type": "UInt64", "value": str(player_id)},
                },
                {"name": "price", "value": {"type": "UFix64", "value": price}},
                {
                    "name": "listingResourceId",
                    "value": {"type": "UInt64", "value": str(resource_id)},
                },
                {
                    "name": "storefrontVersion",
                    "value": {"type": "String", "value": version},
                },
            ],
        },
    }


def cadence_page(
    listings: list[dict[str, object]],
    v1_count: int,
    v2_count: int,
) -> dict[str, object]:
    return {
        "type": "Struct",
        "value": {
            "id": "A.test.ListingPage",
            "fields": [
                {
                    "name": "listings",
                    "value": {"type": "Array", "value": listings},
                },
                {
                    "name": "v1Count",
                    "value": {"type": "Int", "value": str(v1_count)},
                },
                {
                    "name": "v2Count",
                    "value": {"type": "Int", "value": str(v2_count)},
                },
            ],
        },
    }


class MarketplaceSnapshotTests(unittest.TestCase):
    def test_normalize_flow_address(self) -> None:
        self.assertEqual(
            marketplace.normalize_flow_address("  0xAABBCCDDEEFF0011  "),
            "0xaabbccddeeff0011",
        )
        self.assertEqual(marketplace.normalize_flow_address("0x123"), "")
        self.assertEqual(marketplace.normalize_flow_address("0xzzbbccddeeff0011"), "")

    def test_load_owner_wallets_is_unique_sorted_and_validated(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "players.db"
            with sqlite3.connect(database_path) as connection:
                connection.execute("CREATE TABLE players (wallet_address TEXT)")
                connection.executemany(
                    "INSERT INTO players(wallet_address) VALUES (?)",
                    [
                        ("0xBBBBBBBBBBBBBBBB",),
                        ("0xaaaaaaaaaaaaaaaa",),
                        ("0xAAAAAAAAAAAAAAAA",),
                        ("invalid",),
                        ("",),
                        (None,),
                    ],
                )
            self.assertEqual(
                marketplace.load_owner_wallets(database_path),
                ["0xaaaaaaaaaaaaaaaa", "0xbbbbbbbbbbbbbbbb"],
            )

    def test_parse_wallet_page_preserves_exact_price(self) -> None:
        response = cadence_page(
            [cadence_listing(123, "149.50000000", 77, "v2")],
            0,
            1,
        )
        listings, v1_count, v2_count = marketplace.parse_wallet_page_response(
            response,
            "0xaaaaaaaaaaaaaaaa",
        )
        self.assertEqual((v1_count, v2_count), (0, 1))
        self.assertEqual(listings[0].price, Decimal("149.50000000"))
        self.assertEqual(listings[0].storefront_version, "v2")

    def test_wallet_fetch_paginates_large_storefront(self) -> None:
        calls: list[tuple[int, int, int, object]] = []

        def executor(
            owner: str,
            v1_offset: int,
            v2_offset: int,
            limit: int,
            block_height: object,
        ) -> dict[str, object]:
            calls.append((v1_offset, v2_offset, limit, block_height))
            if v1_offset == 0:
                return cadence_page(
                    [cadence_listing(1, "10.00000000", 1, "v1")],
                    30,
                    0,
                )
            return cadence_page(
                [cadence_listing(2, "20.00000000", 2, "v1")],
                30,
                0,
            )

        listings = marketplace.fetch_wallet_listings(
            "0xaaaaaaaaaaaaaaaa",
            block_height=12345,
            page_size=25,
            executor=executor,
        )
        self.assertEqual([row.player_id for row in listings], [1, 2])
        self.assertEqual(
            calls,
            [(0, 0, 25, 12345), (25, 0, 25, 12345)],
        )

    def test_wallet_fetch_halves_page_after_computation_limit(self) -> None:
        calls: list[int] = []

        def executor(
            owner: str,
            v1_offset: int,
            v2_offset: int,
            limit: int,
            block_height: object,
        ) -> dict[str, object]:
            calls.append(limit)
            if limit > 6:
                raise marketplace.FlowComputationLimitError("too large")
            return cadence_page([], 0, 0)

        self.assertEqual(
            marketplace.fetch_wallet_listings(
                "0xaaaaaaaaaaaaaaaa",
                page_size=25,
                executor=executor,
            ),
            [],
        )
        self.assertEqual(calls, [25, 12, 6])

    def test_build_snapshot_uses_lowest_active_price_and_retains_duplicates(self) -> None:
        wallet_a = "0xaaaaaaaaaaaaaaaa"
        wallet_b = "0xbbbbbbbbbbbbbbbb"
        fixtures = {
            wallet_a: [
                marketplace.Listing(
                    42,
                    Decimal("150.00000000"),
                    wallet_a,
                    100,
                    "v1",
                ),
                marketplace.Listing(
                    99,
                    Decimal("75.50000000"),
                    wallet_a,
                    101,
                    "v2",
                ),
            ],
            wallet_b: [
                marketplace.Listing(
                    42,
                    Decimal("125.00000000"),
                    wallet_b,
                    200,
                    "v2",
                )
            ],
        }
        snapshot = marketplace.build_snapshot(
            [wallet_b, wallet_a, wallet_a],
            lambda wallet: fixtures[wallet],
            block_height=777,
            workers=2,
        )
        self.assertEqual(snapshot["flow_block_height"], 777)
        self.assertEqual(snapshot["wallet_count"], 2)
        self.assertEqual(snapshot["listing_count"], 3)
        self.assertEqual(
            snapshot["players"]["42"]["listing_price"],
            "125.00000000",
        )
        self.assertEqual(snapshot["players"]["42"]["listing_count"], 2)

    def test_build_snapshot_aborts_instead_of_publishing_partial_data(self) -> None:
        wallet_a = "0xaaaaaaaaaaaaaaaa"
        wallet_b = "0xbbbbbbbbbbbbbbbb"

        def failing_fetcher(wallet: str) -> list[marketplace.Listing]:
            if wallet == wallet_b:
                raise RuntimeError("Flow unavailable")
            return []

        with self.assertRaisesRegex(RuntimeError, "snapshot aborted"):
            marketplace.build_snapshot(
                [wallet_a, wallet_b],
                failing_fetcher,
                block_height=1,
                workers=2,
            )

    def test_cadence_script_pages_both_storefront_versions_and_mfl_only(self) -> None:
        self.assertIn(
            "import NFTStorefront from 0x4eb8a10cb9f87357",
            PLAYER_LISTINGS_PAGE_SCRIPT,
        )
        self.assertIn(
            "import NFTStorefrontV2 from 0x4eb8a10cb9f87357",
            PLAYER_LISTINGS_PAGE_SCRIPT,
        )
        self.assertIn("v1Offset", PLAYER_LISTINGS_PAGE_SCRIPT)
        self.assertIn("v2Offset", PLAYER_LISTINGS_PAGE_SCRIPT)
        self.assertIn("Type<@MFLPlayer.NFT>()", PLAYER_LISTINGS_PAGE_SCRIPT)
        self.assertIn("details.salePrice", PLAYER_LISTINGS_PAGE_SCRIPT)


if __name__ == "__main__":
    unittest.main()
