import { createRequire } from "node:module";
import { invariant } from "./validation/assertions.mjs";

const require = createRequire(import.meta.url);
const {
  pageRequestEmbedsMarketplace,
  publicPageSnapshotEligible,
} = require("./api/_data-cache-policy");

const eligible = (query, requiresWallet = false) => publicPageSnapshotEligible({ query, requiresWallet });

invariant(eligible({ scope: "database", view: "attributes" }), "Ordinary Database pages must be eligible for database-generation revalidation.");
invariant(eligible({ scope: "agent", view: "attributes", walletAddress: "0xabc" }), "Public Agent pages must be eligible when they do not embed marketplace state.");
invariant(eligible({ scope: "club", view: "current", clubId: "1" }), "Public Club pages must be eligible when they do not embed marketplace state.");
invariant(eligible({ scope: "watchlist", view: "current", playerIds: "1,2" }), "Public Watchlist pages must be eligible when they do not embed marketplace state.");
invariant(eligible({ scope: "mflstats", view: "stats" }), "MFL Stats page data must be eligible when it is SQLite-only.");

invariant(!eligible({ scope: "myplayers", view: "attributes" }, true), "Wallet-owned page data must never use the public page cache policy.");
invariant(!eligible({ scope: "progression", view: "all", access: "full-progression" }, true), "Private full-progression page data must never use the public page cache policy.");
invariant(!eligible({ scope: "database", view: "attributes", access: "owned-progression" }, true), "Owned-progression page data must never use the public page cache policy.");
invariant(!eligible({ scope: "player", playerId: "1" }), "Player pages must stay outside database-only revalidation because their server response embeds marketplace state.");
invariant(eligible({ scope: "evaluation", playerId: "1" }), "Evaluation core page data must use database-generation revalidation now that marketplace is not embedded.");
invariant(!eligible({ scope: "database", sortKey: "listing_price" }), "Listing-sorted pages must stay outside database-only revalidation.");
invariant(!eligible({ scope: "database", filters: JSON.stringify([{ column: "listing_price", operator: "=", value: "for_sale" }]) }), "Listing-filtered pages must stay outside database-only revalidation.");
invariant(pageRequestEmbedsMarketplace({ scope: "database", sortKey: "listing_price" }), "Listing sort must be classified as marketplace-dependent by the canonical page policy.");
invariant(!pageRequestEmbedsMarketplace({ scope: "database", sortKey: "overall" }), "Ordinary Overall sort must remain SQLite-only.");
invariant(!pageRequestEmbedsMarketplace({ scope: "evaluation", playerId: "1" }), "Evaluation core page data must remain SQLite-only.");

console.log("Safe public paged-data revalidation policy validation passed.");
