from pathlib import Path

old = 'html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"])'
new = 'html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]):not([data-stored-wallet-opt-in="false"][data-initial-locked-page])'

for filename in ["site/validate-footer-redesign.mjs", "site/validate-mobile-footer-floor.mjs"]:
    path = Path(filename)
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count < 3:
        raise SystemExit(f"Expected at least 3 legacy fallback references in {filename}; found {count}")
    text = text.replace(old, new)
    if old in text:
        raise SystemExit(f"Legacy fallback selector remains in {filename}")
    path.write_text(text, encoding="utf-8")
