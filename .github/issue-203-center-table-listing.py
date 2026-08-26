from pathlib import Path

app = Path("site/modules/app-core.js")
text = app.read_text(encoding="utf-8")
target = 'cell.innerHTML = listingPriceBadgeHtml(row);'
replacement = 'cell.innerHTML = `<span class="listingCellTableHost">${listingPriceBadgeHtml(row)}</span>`;'
count = text.count(target)
if count != 1:
    raise SystemExit(f"app-core listing table render target: expected 1 match, found {count}")
app.write_text(text.replace(target, replacement, 1), encoding="utf-8")

styles = Path("site/styles.css")
css = styles.read_text(encoding="utf-8")n