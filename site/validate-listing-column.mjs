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
assert.equal(TABLE_BASE_COLUMNS[TABLE_BASE_COLUMNS.indexOf("listing_price") + 1], "age");
assert.ok(TABLE_SORTABLE_COLUMNS.includes("listing_price"));
assert.equal(TABLE_COLUMN_LABELS.listing_price, "Listing");
assert.equal(TABLE_COLUMN_CLASSES.listing_price, "col-listing");

const core = read("site/modules/app-core.js");
assert.match(core, /listingFilterOptions/);
assert.match(core, /value: "for_sale", label: "For Sale"/);
assert.match(core, /value: "not_for_sale", label: "Not For Sale"/);
assert.match(core, /label\.textContent = column === "listing_price"/);
assert.match(core, /listingContent\.className = "listingCellContent"/);
assert.match(core, /icon\.src = "\/listing-shopping-bag\.svg"/);
assert.match(core, /maximumFractionDigits: 0/);

const bootstrap = read("site/bootstrap.js");
assert.match(bootstrap, /label\.textContent = column === "listing_price" \? "" : FIRST_PAINT_COLUMN_LABELS\[column\] \|\| "";/);

const dataPage = read("site/api/_data-page.js");
assert.match(dataPage, /const LISTING_COLUMN = "listing_price"/);
assert.ok(dataPage.includes('AS "${LISTING_COLUMN}"'));
assert.doesNotMatch(dataPage, /quoteIdentifier\(LISTING_COLUMN\)/);
assert.match(dataPage, /const LISTING_PRICE_SQL = "marketplace_price\(player_id\)"/);
assert.doesNotMatch(dataPage, /json_each/);
assert.match(dataPage, /value === "for_sale"/);
assert.match(dataPage, /value === "not_for_sale"/);
assert.match(dataPage, /requestedKey === LISTING_COLUMN/);

const marketplaceState = read("site/api/_marketplace-state.js");
assert.match(marketplaceState, /MARKETPLACE_CACHE_TTL_MS = 30_000/);
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
assert.equal(width("listing"), 6);
const attributesTotal = [
  width("select"), width("id"), width("flag"), width("name"), width("listing"),
  width("age"), width("positions"), width("seasons"), width("overall"),
  width("stat") * 6, width("agent"), width("link"),
].reduce((sum, value) => sum + value, 0);
assert.ok(Math.abs(attributesTotal - 100) < 1e-9, `Attributes widths sum to ${attributesTotal}`);
const contractTotal = [
  width("select"), width("id"), width("flag"), width("name"), width("listing"),
  width("age"), width("positions"), width("seasons"), width("overall"),
  width("contract-revenue"), width("contract-render-club"), width("contract-division"),
  width("contract-agent"), width("contract-link"),
].reduce((sum, value) => sum + value, 0);
assert.ok(Math.abs(contractTotal - 100) < 1e-9, `Contracts widths sum to ${contractTotal}`);
assert.match(styles, /col\.col-listing \{ width: var\(--mfl-table-col-listing\); \}/);
assert.match(styles, /\.listingCellContent \{[\s\S]*align-items: center;/);
assert.match(styles, /listingCellContent:not\(\.listingCellUnlisted\)[\s\S]*background: rgba\(13, 74, 35, 0\.46\);[\s\S]*color: #3bfb52;/);
assert.match(styles, /\.listingCellPrice \{[\s\S]*color: #3bfb52;/);

const svg = read("site/listing-shopping-bag.svg");
assert.match(svg, /width="12" height="12" viewBox="0 0 24 24"/);
assert.match(svg, /stroke="#3bfb52"/);
assert.match(svg, /M16 10a4 4 0 0 1-8 0/);
assert.match(svg, /M3\.103 6\.034h17\.794/);

console.log("Listing column validation passed.");