from pathlib import Path

TARGET = Path(__file__).with_name("run_flow_rebuild.py")
text = TARGET.read_text(encoding="utf-8")

old = "MFL_WORKERS = 80"
new = "MFL_WORKERS = 320"

if old not in text:
    raise SystemExit("Expected MFL_WORKERS = 80 not found; patch not applied.")

text = text.replace(old, new, 1)
TARGET.write_text(text, encoding="utf-8")
print("Updated MFL_WORKERS to 320. The rolling limiter still caps request starts at 80 per 60 seconds.")
