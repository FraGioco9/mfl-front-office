const PAGER_CURRENT_PAGE_INPUT_ID = "pagerCurrentPageInput";
const PAGER_TOTAL_PAGES_ID = "pagerTotalPages";
let suppressedPagerButtonClick = null;
let pagerEditRevision = 0;
let pagerEscapeCaptureInstalled = false;

function pagerCurrentPageControl() {
  let input = document.getElementById(PAGER_CURRENT_PAGE_INPUT_ID);
  let total = document.getElementById(PAGER_TOTAL_PAGES_ID);
  if (input instanceof HTMLInputElement && total instanceof HTMLElement && pageText.contains(input) && pageText.contains(total)) {
    return { input, total };
  }

  input = document.createElement("input");
  input.id = PAGER_CURRENT_PAGE_INPUT_ID;
  input.type = "text";
  input.inputMode = "numeric";
  input.maxLength = 5;
  input.autocomplete = "off";
  input.setAttribute("role", "spinbutton");
  input.setAttribute("aria-label", "Current page");

  total = document.createElement("span");
  total.id = PAGER_TOTAL_PAGES_ID;

  pageText.replaceChildren(document.createTextNode("Page "), input, document.createTextNode(" of "), total);
  return { input, total };
}

function resetPagerCurrentPage(input) {
  const current = input.dataset.currentPage || String(state.page || 1);
  input.value = current;
  input.dataset.dirty = "false";
  input.setAttribute("aria-valuenow", current);
}

function cancelPagerCurrentPageEdit(input) {
  pagerEditRevision += 1;
  input.dataset.cancelCommit = "true";
  resetPagerCurrentPage(input);
  input.blur();
}

function installPagerEscapeCapture() {
  if (pagerEscapeCaptureInstalled) return;
  pagerEscapeCaptureInstalled = true;
  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.key !== "Escape" || !(target instanceof HTMLInputElement) || target.id !== PAGER_CURRENT_PAGE_INPUT_ID) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelPagerCurrentPageEdit(target);
  }, true);
}

function syncPagerCurrentPage(currentPage, totalPages) {
  const controls = pagerCurrentPageControl();
  const total = Math.max(1, Number.parseInt(String(totalPages || 1), 10) || 1);
  const current = Math.min(total, Math.max(1, Number.parseInt(String(currentPage || 1), 10) || 1));
  controls.input.dataset.currentPage = String(current);
  controls.input.dataset.totalPages = String(total);
  controls.input.setAttribute("aria-valuemin", "1");
  controls.input.setAttribute("aria-valuemax", String(total));
  controls.input.setAttribute("aria-valuenow", String(current));
  controls.total.textContent = String(total);
  if (document.activeElement !== controls.input) {
    controls.input.value = String(current);
    controls.input.dataset.dirty = "false";
    delete controls.input.dataset.cancelCommit;
  }
}

async function commitPagerCurrentPage(input) {
  const total = Math.max(1, Number.parseInt(input.dataset.totalPages || "1", 10) || 1);
  const current = Math.min(total, Math.max(1, Number.parseInt(input.dataset.currentPage || String(state.page || 1), 10) || 1));
  const raw = input.value.trim();
  const parsed = /^\d{1,5}$/.test(raw) ? Number.parseInt(raw, 10) : current;
  const target = Math.min(total, Math.max(1, parsed));

  input.value = String(target);
  input.dataset.dirty = "false";
  input.setAttribute("aria-valuenow", String(target));
  if (target === current) return;

  if (state.incrementalMode) {
    input.disabled = true;
    try {
      await reloadIncrementalPage(target, { loadingMode: "blank" });
    } finally {
      input.disabled = false;
    }
    return;
  }

  state.page = target;
  renderTable();
}

function installPagerCurrentPageControl() {
  const controls = pagerCurrentPageControl();
  installPagerEscapeCapture();
  if (controls.input.dataset.pagerCurrentPageBound === "true") return;
  controls.input.dataset.pagerCurrentPageBound = "true";

  controls.input.addEventListener("focus", () => {
    pagerEditRevision += 1;
    delete controls.input.dataset.cancelCommit;
  });

  controls.input.addEventListener("input", () => {
    const raw = controls.input.value;
    const digits = raw.replace(/\D+/g, "").slice(0, 5);
    if (digits !== raw) controls.input.value = digits;
    controls.input.dataset.dirty = "true";
  });

  controls.input.addEventListener("blur", () => {
    const revision = pagerEditRevision;
    queueMicrotask(() => {
      if (revision !== pagerEditRevision || controls.input.dataset.cancelCommit === "true") {
        delete controls.input.dataset.cancelCommit;
        resetPagerCurrentPage(controls.input);
        return;
      }
      void commitPagerCurrentPage(controls.input);
    });
  });

  controls.input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    controls.input.blur();
  });

  [prevButton, nextButton].forEach((button) => {
    button.addEventListener("pointerdown", () => {
      suppressedPagerButtonClick = document.activeElement === controls.input && controls.input.dataset.dirty === "true"
        ? button
        : null;
    }, true);
    button.addEventListener("click", (event) => {
      if (suppressedPagerButtonClick !== button) return;
      suppressedPagerButtonClick = null;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });
}

installPagerCurrentPageControl();
syncPagerCurrentPage(1, 1);
