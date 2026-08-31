import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TABLE_BASE_COLUMNS,
  TABLE_COLUMN_CLASSES,
  TABLE_COLUMN_LABELS,
  TABLE_SORTABLE_COLUMNS,
} from "./modules/app-config.js";

const root = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(root, "..");
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");

assert.equal(TABLE_BASE_COLUMNS[TABLE_BASE_COLUMNS.indexOf("name") + 1], "listing_price");
assert.equal(TABLE_BASE_COLUMNS[TABLE_BASE_COLUMNS.indexOf("listing_price") + 1], "positions");
assert.equal(TABLE_BASE_COLUMNS[TABLE_BASE_COLUMNS.indexOf("positions") + 1], "age");
assert.ok(TABLE_SORTABLE_COLUMNS.includes("listing_price"));
assert.equal(TABLE_COLUMN_LABELS.listing_price, "Listing");
assert.equal(TABLE_COLUMN_CLASSES.listing_price, "col-listing");

const core = [
  "site/modules/core-sources/shared.js",
  "site/modules/core-sources/evaluation.js",
  "site/modules/core-sources/mfl-stats.js",
  "site/modules/core-sources/club.js",
  "site/modules/core-sources/settings.js",
  "site/modules/core-sources/player.js",
  "site/modules/core-sources/table.js",
  "site/modules/core-sources/wallet.js",
  "site/modules/core-sources/watchlist.js",
].map(read).join("\n");
assert.match(core, /listingFilterOptions/);
assert.match(core, /value: "for_sale", label: "For Sale"/);
assert.match(core, /value: "not_for_sale", label: "Not For Sale"/);
assert.match(core, /label\.textContent = !mobileTable/);
assert.match(core, /\? \(column === agentColumn && state\.currentPage === "mfl" \? "" : fullLabel\)/);
assert.match(core, /: column === "listing_price" \|\| \(column === agentColumn && state\.currentPage === "mfl"\)/);
assert.match(core, /function listingPriceBadgeHtml\(row\)/);
assert.match(core, /listingPriceFormatter = new Intl\.NumberFormat\("en-US", \{ maximumFractionDigits: 0 \}\)/);
assert.match(core, /class="listingCellIcon" src="\/listing-shopping-bag\.svg" width="12" height="12"/);
assert.match(core, /const listingBadge = listingPriceBadgeHtml\(row\);/);
assert.match(core, /if \(listingBadge\) \{\s*if \(!window\.matchMedia\("\(max-width: 900px\)"\)\.matches\) \{\s*cell\.innerHTML = `<span class="listingCellTableHost">\$\{listingBadge\}<\/span>`;/);
assert.match(core, /const template = document\.createElement\("template"\);/);
assert.match(core, /badge\.dataset\.tooltip = priceText;/);
assert.match(core, /cell\.setAttribute\("aria-label", "Not For Sale"\);/);
assert.doesNotMatch(core, /listingCellUnlisted/);
assert.match(core, /<span class="playerTitleName">\$\{escapeHtml\(playerName\)\}<\/span>\$\{listingPriceBadgeHtml\(row\)\}<span class="playerTitleNoteIcon"/);

const bootstrap = read("site/bootstrap.js");
assert.match(bootstrap, /function firstPaintTableColumnLabel\(page, column\)/);
assert.match(bootstrap, /const fullLabel = String\(FIRST_PAINT_COLUMN_LABELS\[column\] \|\| ""\);/);
assert.match(bootstrap, /const compactLabel = String\(FIRST_PAINT_COMPACT_COLUMN_LABELS\[column\] \|\| fullLabel\);/);
assert.match(bootstrap, /if \(column === "listing_price" \|\| \(column === agentColumn && normalizedPage === "mfl"\)\) return "";/);
assert.match(bootstrap, /header\.dataset\.tableColumn = column;/);
assert.match(bootstrap, /label\.dataset\.mflFullTableLabel = fullLabel;/);
assert.match(bootstrap, /label\.dataset\.mflCompactTableLabel = compactLabel;/);
assert.match(bootstrap, /label\.textContent = firstPaintTableColumnLabel\(normalizedPage, column\);/);
assert.doesNotMatch(bootstrap, /label\.textContent = FIRST_PAINT_COLUMN_LABELS\[column\] \|\| "";/);

const dataPage = read("site/api/_data-page.js");
assert.match(dataPage, /const LISTING_COLUMN = "listing_price"/);
assert.ok(dataPage.includes('AS "${LISTING_COLUMN}"'));
assert.doesNotMatch(dataPage, /quoteIdentifier\(LISTING_COLUMN\)/);
assert.match(dataPage, /const LISTING_PRICE_SQL = "marketplace_price\(player_id\)"/);
assert.doesNotMatch(dataPage, /json_each/);
assert.doesNotMatch(dataPage, /marketplace\.value/);
assert.match(dataPage, /return `\$\{LISTING_PRICE_SQL\} IS NULL, \$\{LISTING_PRICE_SQL\} \$\{direction\}, player_id DESC`;/);
assert.match(dataPage, /value === "for_sale"/);
assert.match(dataPage, /value === "not_for_sale"/);
assert.match(dataPage, /requestedKey === LISTING_COLUMN/);

const marketplaceState = read("site/api/_marketplace-state.js");
assert.match(marketplaceState, /MARKETPLACE_CACHE_TTL_MS = 5_000/);
assert.match(marketplaceState, /MARKETPLACE_MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/);
assert.match(marketplaceState, /MARKETPLACE_FETCH_TIMEOUT_MS = 3_000/);
assert.match(marketplaceState, /signal: AbortSignal\.timeout\(MARKETPLACE_FETCH_TIMEOUT_MS\)/);
assert.match(marketplaceState, /cache: "no-store"/);

const styles = read("site/styles.css");
const width = (name) => {
  const match = styles.match(new RegExp(`--mfl-table-col-${name}: ([0-9.]+)%`));
  assert.ok(match, `Missing Uniform Width variable: ${name}`);
  return Number(match[1]);
};
assert.equal(width("listing"), 6.3904569176696135);
const attributesTotal = [
  width("select"), width("actions"), width("flag"), width("name"), width("listing"),
  width("positions"), width("age"), width("seasons"), width("overall"),
  width("stat") * 6, width("agent"),
].reduce((sum, value) => sum + value, 0);
assert.ok(Math.abs(attributesTotal - 100) < 1e-9, `Attributes widths sum to ${attributesTotal}`);
const contractTotal = [
  width("select"), width("actions"), width("flag"), width("contract-render-name"), width("listing"),
  width("positions"), width("age"), width("seasons"), width("overall"),
  width("contract-revenue"), width("contract-render-club"), width("contract-division"),
  width("contract-agent"),
].reduce((sum, value) => sum + value, 0);
assert.ok(Math.abs(contractTotal - 100) < 1e-9, `Contracts widths sum to ${contractTotal}`);
assert.match(styles, /col\.col-listing \{ width: var\(--mfl-table-col-listing\); \}/);
assert.match(styles, /#progressionPage #tableBody \.listingCellTableHost \{[\s\S]*display: flex;[\s\S]*align-items: center;[\s\S]*height: var\(--mfl-table-row-height\);/);
assert.match(styles, /#progressionPage \.playerTableScroller th\.col-listing > span:first-child \{[\s\S]*padding-left: 21px;/);
assert.match(styles, /\.listingCellContent \{[\s\S]*align-items: center;[\s\S]*background: rgba\(13, 74, 35, 0\.46\);[\s\S]*color: #3bfb52;/);
assert.match(styles, /\.listingCellPrice \{[\s\S]*color: #3bfb52;/);
assert.match(styles, /\.playerTitle > :is\(\.playerTitleName, \.listingCellContent, \.playerTitleNoteIcon\) \{[\s\S]*vertical-align: middle;/);
assert.match(styles, /\.playerTitle > \.listingCellContent \{[\s\S]*height: 22px;[\s\S]*font-size: 16px;/);
assert.match(styles, /\.playerTitle > \.listingCellContent \.listingCellIcon \{[\s\S]*width: 14px;[\s\S]*height: 14px;/);

const svg = read("site/listing-shopping-bag.svg");
assert.match(svg, /width="12" height="12" viewBox="0 0 24 24"/);
assert.match(svg, /stroke="#3bfb52"/);
assert.match(svg, /M16 10a4 4 0 0 1-8 0/);
assert.match(svg, /M3\.103 6\.034h17\.794/);

console.log("Listing column validation passed.");
