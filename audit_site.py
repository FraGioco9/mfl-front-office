from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "site" / "app.js"
STYLES = ROOT / "site" / "styles.css"
CORE = ROOT / "final_cleanup_core.py"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return source.replace(old, new, 1)


app = APP.read_text(encoding="utf-8")

# The old full-screen loader was already removed from the shell, but several
# call sites and compatibility guards still referenced it. Toasts are now
# independent from page data loading.
old_toast_guard = '''  if (document.body.classList.contains("loading") || !loadingScreen.hidden) {
    state.pendingPostLoadingToast = message instanceof Node
      ? String(message.textContent || "").trim()
      : String(message || "").trim();
    return;
  }

'''
app = replace_once(app, old_toast_guard, "", "legacy toast loading guard")
app = replace_once(app, '  pendingPostLoadingToast: "",\n', "", "post-loading toast state")

post_loading_helpers = '''
function flushPostLoadingToast() {
  const message = state.pendingPostLoadingToast;
  state.pendingPostLoadingToast = "";
  if (message) {
    showGenericToast(message);
  }
}

function showToastAfterLoading(message) {
  if (document.body.classList.contains("appBusy") || document.body.classList.contains("loading") || !loadingScreen.hidden) {
    state.pendingPostLoadingToast = message;
    return;
  }

  showGenericToast(message);
}
'''
app = replace_once(app, post_loading_helpers, "\n", "post-loading toast helpers")
app = app.replace("showToastAfterLoading(", "showToast(")

# The global interaction blocker is a leftover from the previous navigation
# loading model. Incremental requests already expose local placeholders, so a
# document-wide inert layer is both redundant and disruptive.
busy_block = '''
function syncInteractionBusyState() {
  const busy = state.interactionBusyDepth > 0;
  document.documentElement.classList.toggle("appBusy", busy);
  document.body.classList.toggle("appBusy", busy);
  document.body.setAttribute("aria-busy", String(busy));
  Array.from(document.body.children).forEach((element) => {
    if (element instanceof HTMLElement) element.inert = busy;
  });
}

function beginInteractionBusy() {
  state.interactionBusyDepth += 1;
  hideToast();
  syncInteractionBusyState();
}

function endInteractionBusy(options = {}) {
  state.interactionBusyDepth = options.reset
    ? 0
    : Math.max(0, state.interactionBusyDepth - 1);
  syncInteractionBusyState();
  if (state.interactionBusyDepth === 0) {
    flushPostLoadingToast();
  }
}

function blockInteractionWhileBusy(event) {
  if (state.interactionBusyDepth <= 0) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
}

["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"].forEach((eventName) => {
  document.addEventListener(eventName, blockInteractionWhileBusy, true);
});
'''
app = replace_once(app, busy_block, "\n", "global interaction busy system")
app = replace_once(app, '  interactionBusyDepth: 0,\n', "", "interaction busy state")
app = replace_once(app, "  beginInteractionBusy();\n\n  try {", "  try {", "saved-evaluation busy start")
app = replace_once(app, "  } finally {\n    endInteractionBusy();\n  }\n}", "  }\n}", "saved-evaluation busy finish")

# The shell is now visible immediately, so the old booting-class reveal helper
# and its compatibility calls are no-ops.
app, count = re.subn(
    r'\nfunction revealAppShell\(\) \{\n  document\.body\.classList\.remove\("booting"\);\n\}\n',
    "\n",
    app,
    count=1,
)
if count != 1:
    raise RuntimeError(f"Expected one revealAppShell helper; found {count}")
app = re.sub(r'^[ \t]*revealAppShell\(\);\n', "", app, flags=re.M)

# Remove the last navigation path from the retired whole-dataset loader. The
# current route code below this block requests only the SQLite payload needed by
# the destination page/view.
app, count = re.subn(
    r'''  const targetDataAccess = currentDataAccess\(pageName\);\n  const needsPageData = pageRequiresData\(pageName\);\n  const shouldShowNavigationLoading = [\s\S]*?\n  \}\n\n(?=  const previousTablePage = tablePageKey\(\);)''',
    "",
    app,
    count=1,
)
if count != 1:
    raise RuntimeError(f"Expected one legacy navigation loading block; found {count}")

app, count = re.subn(
    r'''\n  if \(state\.dataLoaded && state\.dataAccess && state\.dataAccess !== targetDataAccess && needsPageData\) \{[\s\S]*?\n  \}\n\n  if \(pageRequiresFullData\(pageName\) && state\.dataAccess !== targetDataAccess\) \{[\s\S]*?\n  \}\n''',
    "\n",
    app,
    count=1,
)
if count != 1:
    raise RuntimeError(f"Expected one legacy data snapshot transition block; found {count}")

# Incremental SQLite payloads no longer have a full-dataset promise to clear.
app = re.sub(r'^[ \t]*state\.dataLoadPromise = null;\n', "", app, flags=re.M)

# Evaluation route recovery only needs the incremental request state now. Drop
# the old global busy predicates from both concatenated copies; the core cleanup
# below removes the duplicate copy itself.
old_route_busy = '''        document.documentElement.classList.contains("appBusy")
        || document.body?.classList.contains("appBusy")
        || Number(state?.interactionBusyDepth || 0) > 0
        || state?.incrementalApplying
'''
route_busy_count = app.count(old_route_busy)
if route_busy_count != 2:
    raise RuntimeError(f"Expected two legacy Evaluation busy predicates; found {route_busy_count}")
app = app.replace(old_route_busy, "        state?.incrementalApplying\n")
old_route_busy_fallback = '''      return document.documentElement.classList.contains("appBusy")
        || Boolean(document.body?.classList.contains("appBusy"));
'''
fallback_count = app.count(old_route_busy_fallback)
if fallback_count != 2:
    raise RuntimeError(f"Expected two legacy Evaluation busy fallbacks; found {fallback_count}")
app = app.replace(old_route_busy_fallback, "      return false;\n")
app = app.replace('    body[data-page="evaluation"].appBusy #evaluationPage .evaluationSearchGroup,\n', "")

APP.write_text(app, encoding="utf-8")

# Remove CSS for the retired document-wide busy overlay. Action-specific states
# such as wallet opt-in keep their own scoped wait cursor.
styles = STYLES.read_text(encoding="utf-8")
old_busy_css = '''html.appBusy,
html.appBusy *,
body.appBusy,
body.appBusy * {
  cursor: wait !important;
}

body.appBusy::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  background: transparent;
  cursor: wait;
  pointer-events: auto;
}

body.appBusy .toastMessage {
  visibility: hidden !important;
}

'''
styles = replace_once(styles, old_busy_css, "", "global busy CSS")
STYLES.write_text(styles, encoding="utf-8")

# Execute the broader repository cleanup prepared in the interrupted pass. Patch
# it in memory so the cleaned club transition does not reintroduce the removed
# delayed-toast helper, and strengthen the final invariant list.
source = CORE.read_text(encoding="utf-8")
source = source.replace("          flushPostLoadingToast();\\n", "", 1)
source = source.replace(
    '    "applyPercentageTableColumnWidths",\n]',
    '''    "applyPercentageTableColumnWidths",
    "showLoading(",
    "paintLoadingProgress",
    "interactionBusyDepth",
    "appBusy",
    "pendingPostLoadingToast",
    "showToastAfterLoading",
    "flushPostLoadingToast",
    "revealAppShell",
    "restoreDataSnapshot",
]''',
    1,
)
source = source.replace(
    'Path(__file__).unlink()',
    '(ROOT / "audit_site.py").unlink(missing_ok=True)\n(ROOT / "final_cleanup_core.py").unlink(missing_ok=True)',
    1,
)
exec(compile(source, str(CORE), "exec"), globals(), globals())
