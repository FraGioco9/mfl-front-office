from pathlib import Path

app = Path("site/modules/app-core.js")
text = app.read_text(encoding="utf-8")
if text.count('const listingBadge = listingPriceBadgeHtml(row);') != 1:
    raise SystemExit("app-core listing badge declaration not found exactly once")
target = 'cell.innerHTML = listingBadge;'
replacement = 'cell.innerHTML = listingBadge ? `<span class="listingCellTableHost">${listingBadge}</span>` : "";'
count = text.count(target)
if count != 1:
    raise SystemExit(f"app-core listing table assignment: expected 1 match, found {count}")
app.write_text(text.replace(target, replacement, 1), encoding="utf-8")

styles = Path("site/styles.css")
css = styles.read_text(encoding="utf-8")
anchor = "\n.listingCellContent {\n"
host = "\n#progressionPage #tableBody .listingCellTableHost {\n  display: flex;\n  align-items: center;\n  height: var(--mfl-table-row-height);\n  min-height: var(--mfl-table-row-height);\n  line-height: 1;\n}\n\n.listingCellContent {\n"
if "#progressionPage #tableBody .listingCellTableHost {" not in css:
    count = css.count(anchor)
    if count != 1:
        raise SystemExit(f"styles global listing anchor: expected 1 match, found {count}")
    css = css.replace(anchor, host, 1)
styles.write_text(css, encoding="utf-8")

validator = Path("site/validate-listing-column.mjs")
checks = validator.read_text(encoding="utf-8")
core_anchor = 'assert.match(core, /const listingBadge = listingPriceBadgeHtml\\(row\\);/);\n'
core_check = 'assert.match(core, /cell\\.innerHTML = listingBadge \\? `<span class="listingCellTableHost">\\$\\{listingBadge\\}<\\/span>` : "";/);\n'
if core_check not in checks:
    if checks.count(core_anchor) != 1:
        raise SystemExit("listing validator core anchor missing")
    checks = checks.replace(core_anchor, core_anchor + core_check, 1)
style_anchor = 'assert.match(styles, /\\.listingCellContent \\{[\\s\\S]*align-items: center;[\\s\\S]*background: rgba\\(13, 74, 35, 0\\.46\\);[\\s\\S]*color: #3bfb52;/);\n'
style_check = 'assert.match(styles, /#progressionPage #tableBody \\.listingCellTableHost \\{[\\s\\S]*display: flex;[\\s\\S]*align-items: center;[\\s\\S]*height: var\\(--mfl-table-row-height\\);/);\n'
if style_check not in checks:
    if checks.count(style_anchor) != 1:
        raise SystemExit("listing validator style anchor missing")
    checks = checks.replace(style_anchor, style_check + style_anchor, 1)
validator.write_text(checks, encoding="utf-8")
