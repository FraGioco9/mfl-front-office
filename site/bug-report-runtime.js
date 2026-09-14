(() => {
  "use strict";

  window.__mflBugReportRuntime?.destroy?.();

  const MODAL_TRANSITION_MS = 190;

  let modal = null;
  let form = null;
  let previousFocus = null;
  let submitting = false;
  let closeTimer = 0;
  let backdropPointerStarted = false;

  function currentRoute() {
    return `${window.location.pathname}${window.location.search}` || "/";
  }

  function currentVersion() {
    const version = String(window.__mflReleaseVersion || window.__mflRelease?.version || "").trim();
    return /^\d+\.\d+\.\d+$/.test(version) ? version : "";
  }

  function dataClientFetch(input, init = {}, options = {}) {
    const dataClient = Reflect.get(window, "__mflDataClient");
    if (!dataClient || typeof dataClient.fetch !== "function") {
      return Promise.reject(new Error("Canonical data client is unavailable."));
    }
    return dataClient.fetch(input, init, options);
  }

  function modalMarkup() {
    return `<section class="mflDialog bugReportDialog" role="dialog" aria-modal="true" aria-labelledby="bugReportTitle">
      <header class="mflDialogHeader">
        <h2 id="bugReportTitle">Report a bug</h2>
        <button id="closeBugReportButton" class="iconButton popupCloseButton" type="button" aria-label="Close bug report"></button>
      </header>
      <form id="bugReportForm" class="bugReportForm">
        <div class="bugReportBody">
          <div class="field">
            <span id="bugReportTitleLabel">Title</span>
            <input id="bugReportTitleInput" type="text" maxlength="120" autocomplete="off" required aria-labelledby="bugReportTitleLabel">
          </div>
          <div class="field">
            <span id="bugReportRouteLabel">Route or page</span>
            <input id="bugReportRoute" type="text" maxlength="300" autocomplete="off" required aria-labelledby="bugReportRouteLabel">
          </div>
          <div class="field">
            <span id="bugReportDescriptionLabel">Description</span>
            <textarea id="bugReportDescription" maxlength="4000" required aria-labelledby="bugReportDescriptionLabel"></textarea>
          </div>
          <p id="bugReportStatus" class="bugReportStatus" role="status" aria-live="polite" hidden></p>
        </div>
        <footer class="mflDialogFooter bugReportFooter">
          <button id="cancelBugReportButton" type="button">Cancel</button>
          <button id="submitBugReportButton" type="submit">Submit</button>
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
    modal.querySelector("#closeBugReportButton")?.addEventListener("click", () => closeModal({ reset: true }));
    modal.querySelector("#cancelBugReportButton")?.addEventListener("click", () => closeModal({ reset: true }));
    modal.addEventListener("pointerdown", (event) => {
      backdropPointerStarted = event.target === modal;
    });
    modal.addEventListener("pointercancel", () => {
      backdropPointerStarted = false;
    });
    modal.addEventListener("click", (event) => {
      const shouldCloseFromBackdrop = event.target === modal && backdropPointerStarted;
      backdropPointerStarted = false;
      if (shouldCloseFromBackdrop) closeModal({ reset: true });
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
    if (route instanceof HTMLInputElement) route.value = currentRoute();
  }

  function openModal() {
    const target = ensureModal();
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = 0;
    }

    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    target.classList.remove("modalClosing");
    target.hidden = false;
    target.classList.add("modalOpen");

    backdropPointerStarted = false;
    if (form instanceof HTMLFormElement) form.reset();
    prefillContext();
    setStatus();
    try {
      window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });
    } catch (error) {
      console.warn("Could not hide tooltips before opening the bug report form.", error);
    }

    window.requestAnimationFrame(() => {
      if (target.hidden || !target.classList.contains("modalOpen")) return;
      const title = target.querySelector("#bugReportTitleInput");
      if (title instanceof HTMLInputElement) title.focus();
    });
    return target;
  }

  function closeModal({ reset = true } = {}) {
    if (!(modal instanceof HTMLElement) || modal.hidden || submitting) return false;
    modal.classList.remove("modalOpen");
    modal.classList.add("modalClosing");
    setStatus();
    const focusTarget = previousFocus;
    previousFocus = null;
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      if (!(modal instanceof HTMLElement)) return;
      modal.hidden = true;
      modal.classList.remove("modalClosing");
      if (reset && form instanceof HTMLFormElement) form.reset();
      if (focusTarget?.isConnected) focusTarget.focus();
    }, MODAL_TRANSITION_MS);
    return true;
  }

  function fieldValue(id) {
    const field = modal?.querySelector(`#${id}`);
    return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value : "";
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
      const response = await dataClientFetch("/api/bug-reports", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...walletHeaders(),
        },
        body: JSON.stringify({
          title: fieldValue("bugReportTitleInput"),
          route: fieldValue("bugReportRoute"),
          description: fieldValue("bugReportDescription"),
          appVersion: currentVersion(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error || "Could not submit bug report."));

      submitting = false;
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit";
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
        submitButton.textContent = "Submit";
      }
    }
  }

  function handleEscape(event) {
    if (event.key !== "Escape" || !(modal instanceof HTMLElement) || modal.hidden || submitting) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeModal({ reset: true });
  }

  function bind() {
    window.addEventListener("keydown", handleEscape, true);
  }

  function destroy() {
    window.removeEventListener("keydown", handleEscape, true);
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = 0;
    modal?.remove();
    modal = null;
    form = null;
    previousFocus = null;
    submitting = false;
    backdropPointerStarted = false;
  }

  bind();
  window.__mflBugReportRuntime = Object.freeze({ open: openModal, close: closeModal, destroy });
})();
