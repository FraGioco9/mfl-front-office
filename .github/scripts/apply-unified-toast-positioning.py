from pathlib import Path

layout_path = Path("site/modules/core-sources/shared-layout-center.js")
layout = layout_path.read_text(encoding="utf-8")
old_layout = '''function syncLayoutCenter() {
  const selection = document.querySelector("#selectionBar");
  const pageLayout = document.querySelector("main");
  if (!pageLayout) return;
  const bounds = pageLayout.getBoundingClientRect();
  const center = `${bounds.left + (bounds.width / 2)}px`;
  window.__mflToastPosition?.sync?.();
  selection?.style.setProperty("--selection-center-x", center);
}
'''
new_layout = '''function syncLayoutCenter() {
  const selection = document.querySelector("#selectionBar");
  const pageLayout = document.querySelector("main");
  if (!pageLayout) return;
  const bounds = pageLayout.getBoundingClientRect();
  const center = `${bounds.left + (bounds.width / 2)}px`;
  document.documentElement.style.setProperty("--toast-center-x", center);
  selection?.style.setProperty("--selection-center-x", center);
}
'''
if layout.count(old_layout) != 1:
    raise SystemExit("Expected one canonical shared layout-center block")
layout_path.write_text(layout.replace(old_layout, new_layout, 1), encoding="utf-8")

stack_path = Path("site/selection-stack-runtime.js")
stack = stack_path.read_text(encoding="utf-8")
old_sync = '''  function syncToastPosition() {
    const main = document.querySelector("#appShell main, main");
    if (main instanceof HTMLElement) {
      const rect = main.getBoundingClientRect();
      document.documentElement.style.setProperty("--toast-center-x", `${Math.round(rect.left + rect.width / 2)}px`);
    } else {
      document.documentElement.style.removeProperty("--toast-center-x");
    }
    document.documentElement.style.setProperty("--mfl-toast-bottom", `${desiredToastBottom()}px`);
  }
'''
new_sync = '''  function syncToastPosition() {
    document.documentElement.style.setProperty("--mfl-toast-bottom", `${desiredToastBottom()}px`);
  }
'''
if stack.count(old_sync) != 1:
    raise SystemExit("Expected one selection-stack toast position block")
stack = stack.replace(old_sync, new_sync, 1)
old_cleanup = '''    document.documentElement.style.removeProperty("--selection-center-x");
    document.documentElement.style.removeProperty("--mfl-selection-bar-bottom");
    document.documentElement.style.removeProperty("--toast-center-x");
    document.documentElement.style.removeProperty("--mfl-toast-bottom");
'''
new_cleanup = '''    document.documentElement.style.removeProperty("--selection-center-x");
    document.documentElement.style.removeProperty("--mfl-selection-bar-bottom");
    document.documentElement.style.removeProperty("--mfl-toast-bottom");
'''
if stack.count(old_cleanup) != 1:
    raise SystemExit("Expected one selection-stack positioning cleanup block")
stack_path.write_text(stack.replace(old_cleanup, new_cleanup, 1), encoding="utf-8")
