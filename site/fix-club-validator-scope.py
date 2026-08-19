from pathlib import Path

path = Path(__file__).resolve().parent / "validate-club-route-core.mjs"
text = path.read_text(encoding="utf-8")
old = '''const sharedCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
'''
new = '''const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");
const clubCore = String(artifacts.routeChunks?.club || "");
'''
if old not in text:
    raise RuntimeError("Could not add Table core validator scope")
text = text.replace(old, new, 1)
old = '''includes(sharedCore, 'else if (pageName !== "club") {', "Shared view rendering must not rewrite the Club title during a view switch.");
excludes(sharedCore, 'tablePageTitle.textContent = club?.name || "Club";', "Incremental Club payloads must not replace the loaded Club title.");
'''
new = '''includes(tableCore, 'else if (pageName !== "club") {', "The shared Table view renderer must not rewrite the Club title during a view switch.");
excludes(sharedCore, 'tablePageTitle.textContent = club?.name || "Club";', "Incremental Club payloads must not replace the loaded Club title.");
'''
if old not in text:
    raise RuntimeError("Could not correct Club title validator scope")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Corrected Club title validator ownership scope.")
