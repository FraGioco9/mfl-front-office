from pathlib import Path

app_path = Path("site/app.js")
source = app_path.read_text(encoding="utf-8")

obsolete_rules = (
    '    .appShell:not(.menuClosed) .tableScroller .col-age { width: 2.5% !important; }\n',
    '    .appShell:not(.menuClosed) .tableScroller .col-positions { width: 10% !important; }\n',
    '    .appShell.menuClosed .tableScroller .col-age { width: 36.9px !important; }\n',
    '    .appShell.menuClosed .tableScroller .col-positions { width: 147.6px !important; }\n',
)
for rule in obsolete_rules:
    source = source.replace(rule, "")

marker = "/* Single exact player-table width engine */"
engine_start = f'{marker}\n(() => {{\n'
stable_width_setup = (
    f'{engine_start}'
    '  document.documentElement.style.setProperty("overflow-y", "scroll", "important");\n'
    '  document.documentElement.style.setProperty("scrollbar-gutter", "stable", "important");\n\n'
)

if engine_start not in source:
    raise SystemExit("Single exact player-table width engine not found")

source = source.replace(engine_start, stable_width_setup, 1)
app_path.write_text(source, encoding="utf-8")

for temporary_path in (
    ".github/scripts/patch_current_app_width.py",
    ".github/workflows/one-time-merge-table-width-fix.yml",
    ".github/workflows/one-time-current-app-table-width-fix.yml",
    ".github/table-width-trigger",
    ".github/pr-table-width-trigger",
):
    Path(temporary_path).unlink(missing_ok=True)
