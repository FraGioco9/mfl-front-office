(() => {
  "use strict";

  window.__mflBugReportRuntime?.destroy?.();

  const REPORT_LINK_SELECTOR = '.siteFooterDetails a[href*="/mfl-front-office/issues/new"]';
  const AREA_OPTIONS = [
    "Database / MFL",
    "Club / Agent / Player pages",
    "Watchlist / My Players",
    "Evaluation",
    "Search / Filters",
    "Loading / Navigation",
    "Settings / Account",
    "Database builder / Data pipeline",
    "Other",
  ];

  let modal = null;
  let form = null;
  let reportLink = null;
  let previousFocus = null;
  let unregisterEscapeHandler = null;
  let submitting = false;

  function currentRoute() {
    return `${window.location.pathname}${window.location.search}` || "/";
  }

  function currentEnvironment() {
    const platform = String(navigator.userAgentData?.platform || navigator.platform || "").trim();
    const userAgent = String(navigator.userAgent || "").trim();
    return [platform, userAgent].filter(Boolean).join(" / ").slice(0, 300);
  }

  function currentVersion() {
    const version = String(window.__mflReleaseVersion || window.__mflRelease?.version || "").trim();
    return /^\d+\.\d+\.\d+$/.test(version) ? version : "";
  }

  function modalMarkup() {
    const areaOptions = AREA_OPTIONS
      .map((area) => `<option value="${area}">${area}</option>`)
      .join("");

    return `<section class="bugReportDialog" role="dialog" aria-modal="true" aria-labelledby="bugReportTitle">
      <header class="filtersHeader">
        <h2 id="bugReportTitle">Report a bug</h2>
        <button id="closeBugReportButton" class="iconButton popupCloseButton" type="button" aria-label="Close bug report"></button>
      </header>
      <form id="bugReportForm" class="bugReportForm">
        <div class="bugReportBody">
          <label class="field bugReportFieldWide">
            <span>Summary</span>
            <input id="bugReportSummary" type="text" maxlength="120" autocomplete="off" required placeholder="Short description of the problem">
          </label>
          <label class="field">
            <span>Area</span>
            <select id="bugReportArea" required>${areaOptions}</select>
          </label>
          <label class="field">
            <span>Route or page</span>
            <input id="bugReportRoute" type="text" maxlength="300" autocomplete="off" required>
          </label>
          <label class="field bugReportFieldWide">
            <span>Steps to reproduce</span>
            <textarea id="bugReportReproduction" maxlength="4000" required placeholder="1. Open ...&#10;2. Click ...&#10;3. Observe ..."></textarea>
          </label>
          <label class="field bugReportFieldWide">
            <span>Expected behavior</span>
            <textarea id="bugReportExpected" maxlength="2000" required></textarea>
          </label>
          <label class="field bugReportFieldWide">
            <span>Actual behavior</span>
            <textarea id="bugReportActual" maxlength="2000" required></textarea>
          </label>
          <label class="field bugReportFieldWide">
            <span>Device and browser</span>
            <input id="bugReportEnvironment" type="text" maxlength="300" autocomplete="off">
          </label>
          <label class="field bugReportFieldWide">
            <span>Screenshots, console errors, or extra context</span>
            <textarea id="bugReportEvidence" maxlength="4000" placeholder="Paste links, console messages, or any additional context"></textarea>
          </label>
          <p id="bugReportStatus" class="bugReportStatus" role="status" aria-live="polite" hidden></p>
        </div>
        <footer class="filtersFooter bugReportFooter">
          <button id="cancelBugReportButton" type="button">Cancel</button>
          <button id="submitBugReportButton" class="bugReportSubmitButton" type="submit">Submit report</button>
        </footer>
      </form>
    </section>`;
  }

  function ensureModal() {
    if (modal?.isConnected && form?.isConnected) return modal;

    modal = document.createElement("div");
    modal.id = "bugReportModal";
    modal.className = "modalBackdrop bugReportModal";
    modal.hidden = true;
    modal.innerHTML = modalMarkup();
    document.body.appendChild(modal);

    form = modal.querySelector("#bugReportForm");
    modal.querySelector("#closeBugReportButton")?.addEventListener("click", () => closeModal());
    modal.querySelector("#cancelBugReportButton")?.addEventListener("click", () => closeModal());
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    form?.addEventListener("submit", submitReport);
    return modal;
  }

  function setStatus(message = "", isError = false) {
    const status = modal?.querySelector("#bugReportStatus");
    if (!(status instanceof HTMLElement)) return;
    status.textContent = String(message || "");
    status.hidden = !status.textContent;
    status.classList.toggle("isError", Boolean(isError));
  }

  function prefillContext() {
    const route = modal?.querySelector("#bugReportRoute");
    const environment = modal?.querySelector("#bugReportEnvironment");
    if (route instanceof HTMLInputElement) route.value = currentRoute();
    if (environment instanceof HTMLInputElement && !environment.value.trim()) environment.value = currentEnvironment();
  }

  function openModal() {
    const target = ensureModal();
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    prefillContext();
    setStatus();
    window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });
    target.hidden = false;
    requestAnimationFrame(() => {
      const summary = target.querySelector("#bugReportSummary");
      if (summary instanceof HTMLInputElement) summary.focus();
    });
  }

  function closeModal({ reset = false } = {}) {
    if (!(modal instanceof HTMLElement) || modal.hidden || submitting) return false;
    modal.hidden = true;
    setStatus();
    if (reset && form instanceof HTMLFormElement) form.reset();
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
    return true;
  }

  function fieldValue(id) {
    const field = modal?.querySelector(`#${id}`);
    return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement
      ? field.value
      : "";
  }

  function walletHeaders() {
    const buildHeaders = Reflect.get(window, "walletProofHeaders");
    if (typeof buildHeaders !== "function") return {};
    try {
      const headers = buildHeaders(true);
      return headers && typeof headers === "object" ? headers : {};
    } catch {
      return {};
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (submitting || !(form instanceof HTMLFormElement)) return;
    if (!form.reportValidity()) return;

    const submitButton = modal?.querySelector("#submitBugReportButton");
    submitting = true;
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }
    setStatus();

    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...walletHeaders(),
        },
        body: JSON.stringify({
          summary: fieldValue("bugReportSummary"),
          area: fieldValue("bugReportArea"),
          route: fieldValue("bugReportRoute"),
          reproduction: fieldValue("bugReportReproduction"),
          expected: fieldValue("bugReportExpected"),
          actual: fieldValue("bugReportActual"),
          environment: fieldValue("bugReportEnvironment"),
          evidence: fieldValue("bugReportEvidence"),
          appVersion: currentVersion(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error || "Could not submit bug report."));

      submitting = false;
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit report";
      }
      closeModal({ reset: true });
      const showToast = Reflect.get(window, "showToast");
      if (typeof showToast === "function") showToast("Bug report submitted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not submit bug report.", true);
    } finally {
      submitting = false;
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit report";
      }
    }
  }

  function handleReportLink(event) {
    if (event instanceof MouseEvent
        && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) {
      return;
    }
    event.preventDefault();
    openModal();
  }

  function handleEscape(event) {
    if (event.key !== "Escape" || !(modal instanceof HTMLElement) || modal.hidden || submitting) return false;
    event.preventDefault();
    closeModal();
    return true;
  }

  function bind() {
    reportLink = document.querySelector(REPORT_LINK_SELECTOR);
    reportLink?.addEventListener("click", handleReportLink);
    unregisterEscapeHandler = window.__mflControlInteractionsRuntime?.registerEscapeHandler?.(
      "bug-report",
      handleEscape,
      { priority: 250 },
    ) || null;
  }

  function destroy() {
    reportLink?.removeEventListener("click", handleReportLink);
    unregisterEscapeHandler?.();
    unregisterEscapeHandler = null;
    modal?.remove();
    modal = null;
    form = null;
    reportLink = null;
    previousFocus = null;
    submitting = false;
  }

  bind();
  window.__mflBugReportRuntime = Object.freeze({ open: openModal, close: closeModal, destroy });
})();
