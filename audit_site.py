from pathlib import Path

ROOT = Path(__file__).resolve().parent
app_path = ROOT / "site" / "app.js"
app = app_path.read_text(encoding="utf-8")

old_show_toast = 'if (document.body.classList.contains("loading") || !loadingScreen.hidden) {'
old_show_after = 'if (document.body.classList.contains("appBusy") || document.body.classList.contains("loading") || !loadingScreen.hidden) {'
if app.count(old_show_toast) != 1:
    raise RuntimeError(f"Expected one legacy showToast loading guard; found {app.count(old_show_toast)}")
if app.count(old_show_after) != 1:
    raise RuntimeError(f"Expected one legacy showToastAfterLoading guard; found {app.count(old_show_after)}")
app = app.replace(old_show_toast, 'if (document.body.classList.contains("appBusy")) {', 1)
app = app.replace(old_show_after, 'if (document.body.classList.contains("appBusy")) {', 1)
app_path.write_text(app, encoding="utf-8")

core_path = ROOT / "final_cleanup_core.py"
source = core_path.read_text(encoding="utf-8")
source = source.replace(
    'Path(__file__).unlink()',
    '(ROOT / "audit_site.py").unlink(missing_ok=True)\n(ROOT / "final_cleanup_core.py").unlink(missing_ok=True)',
    1,
)
exec(compile(source, str(core_path), "exec"), globals(), globals())
