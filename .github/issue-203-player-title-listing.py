from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


core_path = Path("site/modules/app-core.js")
core = core_path.read_text(encoding="utf-8")

helper_anchor = "function rowByPlayerId(playerId) {\n"
helper = '''const listingPriceFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function listingPriceBadgeHtml(row) {
  const rawValue = getValue(row, "listing_price");
  const numericValue = rawValue === null || rawValue === undefined || rawValue === "" ? NaN : Number(rawValue);
  if (!Number.isFinite(numericValue)) return "";
  const priceText = `$${listingPriceFormatter.format(numericValue)}`;
  return `<span class="listingCellContent" aria-label="For Sale at ${escapeHtml(priceText)}"><img class="listingCellIcon" src="/listing-shopping-bag.svg" width="12" height="12" alt="" aria-hidden="true"><span class="listingCellPrice">${escapeHtml(priceText)}</span></span>`;
}

'''
if core.count(helper_anchor) != 1:
    raise SystemExit("app-core.js: rowByPlayerId anchor missing or duplicated")
core = core.replace(helper_anchor, helper + helper_anchor, 1)

old_listing = '''      } else if (column === "listing_price") {
        const listingContent = document.createElement("span");
        listingContent.className = "listingCellContent";
        const rawListingValue = getValue(row, column);
        const listingValue = rawListingValue === null || rawListingValue === undefined || rawListingValue === "" ? NaN : Number(rawListingValue);
        if (Number.isFinite(listingValue)) {
          const icon = document.createElement("img");
          icon.className = "listingCellIcon";
          icon.src = "/listing-shopping-bag.svg";
          icon.width = 12;
          icon.height = 12;
          icon.alt = "";
          icon.setAttribute("aria-hidden", "true");
          const price = document.createElement("span");
          price.className = "listingCellPrice";
          price.textContent = `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(listingValue)}`;
          listingContent.setAttribute("aria-label", `For Sale at ${price.textContent}`);
          listingContent.append(icon, price);
        } else {
          listingContent.classList.add("listingCellUnlisted");
          listingContent.setAttribute("aria-label", "Not For Sale");
        }
        cell.appendChild(listingContent);
'''
new_listing = '''      } else if (column === "listing_price") {
        const listingBadge = listingPriceBadgeHtml(row);
        if (listingBadge) {
          cell.innerHTML = listingBadge;
        } else {
          cell.setAttribute("aria-label", "Not For Sale");
        }
'''
if core.count(old_listing) != 1:
    raise SystemExit("app-core.js: listing renderer block missing or duplicated")
core = core.replace(old_listing, new_listing, 1)

old_title = '<h2 class="playerTitle"><span class="playerTitleName">${escapeHtml(playerName)}</span><span class="playerTitleNoteIcon" data-player-note-title-icon>${playerNoteIconHtml(id)}</span></h2>'
new_title = '<h2 class="playerTitle"><span class="playerTitleName">${escapeHtml(playerName)}</span>${listingPriceBadgeHtml(row)}<span class="playerTitleNoteIcon" data-player-note-title-icon>${playerNoteIconHtml(id)}</span></h2>'
if core.count(old_title) != 1:
    raise SystemExit("app-core.js: player title anchor missing or duplicated")
core = core.replace(old_title, new_title, 1)
core_path.write_text(core, encoding="utf-8")

styles_path = Path("site/styles.css")
styles = styles_path.read_text(encoding="utf-8")
old_styles = '''#progressionPage #tableBody .listingCellContent {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  line-height: 1;
  white-space: nowrap;
}

#progressionPage #tableBody .listingCellContent:not(.listingCellUnlisted) {
  height: 20px;
  padding: 0 5px;
  border-radius: 5px;
  background: rgba(13, 74, 35, 0.46);
  color: #3bfb52;
}

#progressionPage #tableBody .listingCellIcon {
  flex: 0 0 12px;
  width: 12px;
  height: 12px;
}

#progressionPage #tableBody .listingCellPrice {
  overflow: hidden;
  color: #3bfb52;
  text-overflow: ellipsis;
}

#progressionPage #tableBody .listingCellUnlisted {
  color: var(--text-muted);
}
'''
new_styles = '''.listingCellContent {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 20px;
  padding: 0 5px;
  border-radius: 5px;
  background: rgba(13, 74, 35, 0.46);
  color: #3bfb52;
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
}

.listingCellIcon {
  flex: 0 0 12px;
  width: 12px;
  height: 12px;
}

.listingCellPrice {
  overflow: hidden;
  color: #3bfb52;
  text-overflow: ellipsis;
}

.playerTitle > .listingCellContent {
  margin-left: 6px;
  font-size: 14px;
  font-weight: 400;
}
'''
if styles.count(old_styles) != 1:
    raise SystemExit("styles.css: listing style block missing or duplicated")
styles_path.write_text(styles.replace(old_styles, new_styles, 1), encoding="utf-8")

shared_validator_path = Path("site/validate-shared-core-route-ownership.mjs")
shared_validator = shared_validator_path.read_text(encoding="utf-8")
shared_anchor = '  "playerIsInAnyWatchlist",\n];'
shared_replacement = '  "playerIsInAnyWatchlist",\n  "listingPriceBadgeHtml",\n];'
if shared_validator.count(shared_anchor) != 1:
    raise SystemExit("validate-shared-core-route-ownership.mjs: protected shared anchor missing")
shared_validator_path.write_text(shared_validator.replace(shared_anchor, shared_replacement, 1), encoding="utf-8")

listing_validator_path = Path("site/validate-listing-column.mjs")
listing_validator = listing_validator_path.read_text(encoding="utf-8")
old_assertions = '''assert.match(core, /listingContent\\.className = "listingCellContent"/);
assert.match(core, /icon\\.src = "\\/listing-shopping-bag\\.svg"/);
assert.match(core, /maximumFractionDigits: 0/);
assert.doesNotMatch(core, /listingContent\\.textContent = "—"/);
assert.match(core, /listingContent\\.classList\\.add\\("listingCellUnlisted"\\);[\\s\\S]*listingContent\\.setAttribute\\("aria-label", "Not For Sale"\\);/);
'''
new_assertions = '''assert.match(core, /function listingPriceBadgeHtml\\(row\\)/);
assert.match(core, /listingPriceFormatter = new Intl\\.NumberFormat\\("en-US", \\{ maximumFractionDigits: 0 \\}\\)/);
assert.match(core, /class="listingCellIcon" src="\\/listing-shopping-bag\\.svg" width="12" height="12"/);
assert.match(core, /const listingBadge = listingPriceBadgeHtml\\(row\\);/);
assert.match(core, /cell\\.setAttribute\\("aria-label", "Not For Sale"\\);/);
assert.doesNotMatch(core, /listingCellUnlisted/);
assert.match(core, /<span class="playerTitleName">\\$\\{escapeHtml\\(playerName\\)\\}<\\/span>\\$\\{listingPriceBadgeHtml\\(row\\)\\}<span class="playerTitleNoteIcon"/);
'''
if listing_validator.count(old_assertions) != 1:
    raise SystemExit("validate-listing-column.mjs: renderer assertions missing")
listing_validator = listing_validator.replace(old_assertions, new_assertions, 1)
old_style_assertions = '''assert.match(styles, /\\.listingCellContent \\{[\\s\\S]*align-items: center;/);
assert.match(styles, /listingCellContent:not\\(\\.listingCellUnlisted\\)[\\s\\S]*background: rgba\\(13, 74, 35, 0\\.46\\);[\\s\\S]*color: #3bfb52;/);
assert.match(styles, /\\.listingCellPrice \\{[\\s\\S]*color: #3bfb52;/);
'''
new_style_assertions = '''assert.match(styles, /\\.listingCellContent \\{[\\s\\S]*align-items: center;[\\s\\S]*background: rgba\\(13, 74, 35, 0\\.46\\);[\\s\\S]*color: #3bfb52;/);
assert.match(styles, /\\.listingCellPrice \\{[\\s\\S]*color: #3bfb52;/);
assert.match(styles, /\\.playerTitle > \\.listingCellContent \\{[\\s\\S]*margin-left: 6px;[\\s\\S]*font-size: 14px;/);
'''
if listing_validator.count(old_style_assertions) != 1:
    raise SystemExit("validate-listing-column.mjs: style assertions missing")
listing_validator_path.write_text(listing_validator.replace(old_style_assertions, new_style_assertions, 1), encoding="utf-8")
