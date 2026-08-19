from pathlib import Path

root = Path(__file__).resolve().parent

config_path = root / "modules" / "app-config.js"
lines = config_path.read_text(encoding="utf-8").splitlines()
inside_club_route = False
patched_path = patched_match = patched_startup = False
for index, line in enumerate(lines):
    if line.startswith("  function clubRoute(pathname = location.pathname) {"):
        inside_club_route = True
        continue
    if inside_club_route and line.startswith("  function initialRequest("):
        inside_club_route = False
    if inside_club_route and line.strip().startswith("const path = String(pathname"):
        lines[index] = r'    const path = String(pathname || "/").split("?")[0].replace(/\\/+$/, "") || "/";'
        patched_path = True
    elif inside_club_route and line.strip().startswith("const match = path.match("):
        lines[index] = r'    const match = path.match(/^\\/clubs\\/([^/]+)\\/(squad|contracts|current-season|all-time)$/i);'
        patched_match = True
    elif line.strip().startswith("const initialClubLikePath ="):
        lines[index] = r'  const initialClubLikePath = /^\\/(?:clubs|club)(?:\\/|$)/i.test(initialClubPath);'
        patched_startup = True
if not all((patched_path, patched_match, patched_startup)):
    raise RuntimeError("Could not patch all generated app-config Club regex escapes")
config_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

chunks_path = root / "modules" / "app-core-route-chunks.js"
lines = chunks_path.read_text(encoding="utf-8").splitlines()
patched_chunk_regexes = 0
for index, line in enumerate(lines):
    if line.strip() == r'if (/^\/(?:clubs|club)(?:\/|$)/i.test(path) && !route) {':
        lines[index] = r'    if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(path) && !route) {'
        patched_chunk_regexes += 1
if patched_chunk_regexes != 2:
    raise RuntimeError(f"Expected 2 Club chunk regex escapes, patched {patched_chunk_regexes}")
chunks_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

print("Fixed generated Club regex escaping.")
