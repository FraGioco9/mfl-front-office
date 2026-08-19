from pathlib import Path
import json
import re

root = Path(__file__).resolve().parent

bootstrap = root / "bootstrap.js"
text = bootstrap.read_text(encoding="utf-8")
old = 'const STATIC_RELEASE_VERSION = "1.124.60";'
new = 'const STATIC_RELEASE_VERSION = "1.124.1";'
if old not in text:
    raise RuntimeError("bootstrap.js current release literal was not found")
bootstrap.write_text(text.replace(old, new, 1), encoding="utf-8")

bootstrap_core = root / "bootstrap-core.js"
text = bootstrap_core.read_text(encoding="utf-8")
old = 'String(window.__mflReleaseVersion || "1.124.60")'
new = 'String(window.__mflReleaseVersion || "1.124.1")'
if old not in text:
    raise RuntimeError("bootstrap-core.js current release fallback was not found")
bootstrap_core.write_text(text.replace(old, new, 1), encoding="utf-8")

history_path = root / "release-history-overrides.json"
history = json.loads(history_path.read_text(encoding="utf-8"))
filtered = []
for entry in history:
    version = str(entry[0]) if isinstance(entry, list) and entry else ""
    match = re.fullmatch(r"v1\.124\.(\d+)", version)
    if match and int(match.group(1)) >= 1:
        continue
    filtered.append(entry)
history_path.write_text(json.dumps(filtered, indent=2) + "\n", encoding="utf-8")

index = (root / "index.html").read_text(encoding="utf-8")
if "MFL Front Office v1.124.1" not in index:
    raise RuntimeError("index.html footer fallback must remain v1.124.1")

release = json.loads((root / "release.json").read_text(encoding="utf-8"))
if release.get("version") != "1.124.1":
    raise RuntimeError("release.json must be v1.124.1 before applying history reset")

remaining = [
    str(entry[0])
    for entry in filtered
    if isinstance(entry, list)
    and entry
    and re.fullmatch(r"v1\.124\.(?:[1-9]\d*)", str(entry[0]))
]
if remaining:
    raise RuntimeError(f"Unexpected post-reset 1.124 patch entries remain: {remaining}")

print("Reset 1.124 patch history to current v1.124.1.")
