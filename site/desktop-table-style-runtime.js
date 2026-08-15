(() => {
  "use strict";

  const STYLESHEET_PATH = "/desktop-table-layout.css";
  if (!document.querySelector(`link[data-mfl-stylesheet="${STYLESHEET_PATH}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLESHEET_PATH;
    link.dataset.mflStylesheet = STYLESHEET_PATH;
    document.head.appendChild(link);
  }

  const COPY_SELECTOR = "[data-agent-wallet-copy]";
  let suppressClickUntil = 0;
  let titleObserver = null;
  let syncFrame = 0;

  function normalizeAgentAddress(value) {
    const address = String(value || "").trim().toLowerCase();
    return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
  }

  function agentAddressFromPath() {
    const match = String(window.location.pathname || "").match(/^\/agents\/([^/?#]+)(?:\/|$)/i);
    if (!match) return "";
    try {
      return normalizeAgentAddress(decodeURIComponent(match[1] || ""));
    } catch {
      return normalizeAgentAddress(match[1] || "");
    }
  }

  function showCopyTooltip(target) {
    if (!(target instanceof HTMLElement)) return;
    try {
      if (typeof showPlayerNoteTooltip === "function") showPlayerNoteTooltip(target);
    } catch {
      // The core tooltip owner may not be ready during the earliest startup paint.
    }
  }

  function hideCopyTooltip(immediate = false) {
    try {
      if (typeof hidePlayerNoteTooltip === "function") hidePlayerNoteTooltip({ immediate });
    } catch {
      // The core tooltip owner may not be ready during the earliest startup paint.
    }
  }

  function attachCopyTargetEvents(target) {
    target.addEventListener("mouseenter", () => showCopyTooltip(target));
    target.addEventListener("mouseleave", () => hideCopyTooltip());
    target.addEventListener("blur", () => hideCopyTooltip());
  }

  function syncAgentWalletCopyTarget() {
    syncFrame = 0;
    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement)) return;

    const address = agentAddressFromPath();
    if (!address) return;

    const existing = title.querySelector(COPY_SELECTOR);
    if (existing instanceof HTMLElement
      && normalizeAgentAddress(existing.dataset.agentWalletCopy) === address) return;

    const text = String(title.textContent || "");
    const lowerText = text.toLowerCase();
    const addressIndex = lowerText.lastIndexOf(address);
    if (addressIndex < 0 || addressIndex + address.length !== lowerText.length) return;

    const prefix = text.slice(0, addressIndex);
    const visibleAddress = text.slice(addressIndex);
    const target = document.createElement("span");
    target.className = "agentWalletCopyTarget";
    target.dataset.agentWalletCopy = address;
    target.dataset.tooltip = "Click to copy";
    target.setAttribute("role", "button");
    target.setAttribute("tabindex", "0");
    target.setAttribute("aria-label", "Click to copy wallet address");
    target.textContent = visibleAddress;
    attachCopyTargetEvents(target);

    title.replaceChildren(document.createTextNode(prefix), target);
  }

  function scheduleCopyTargetSync() {
    if (syncFrame) cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(syncAgentWalletCopyTarget);
  }

  function installTitleObserver() {
    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement) || titleObserver) return;
    titleObserver = new MutationObserver(scheduleCopyTargetSync);
    titleObserver.observe(title, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  async function copyWalletAddress(target, event) {
    const address = normalizeAgentAddress(target?.dataset?.agentWalletCopy);
    if (!address) return;

    event?.preventDefault?.();
    event?.stopPropagation?.();
    suppressClickUntil = Date.now() + 350;
    hideCopyTooltip(true);
    target.blur?.();

    try {
      await navigator.clipboard.writeText(address);
      if (typeof showToast === "function") showToast("Wallet address copied.");
    } catch {
      if (typeof showToast === "function") showToast("Could not copy wallet address.");
    }
  }

  function copyTargetFromEvent(event) {
    const target = event.target instanceof Element ? event.target.closest(COPY_SELECTOR) : null;
    return target instanceof HTMLElement ? target : null;
  }

  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = copyTargetFromEvent(event);
    if (target) void copyWalletAddress(target, event);
  }, true);

  document.addEventListener("click", (event) => {
    const target = copyTargetFromEvent(event);
    if (!target) return;
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    void copyWalletAddress(target, event);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = copyTargetFromEvent(event);
    if (target) void copyWalletAddress(target, event);
  }, true);

  const syncAfterRoute = () => {
    installTitleObserver();
    scheduleCopyTargetSync();
  };
  window.addEventListener("mfl:ready", syncAfterRoute);
  window.addEventListener("pageshow", syncAfterRoute);
  window.addEventListener("popstate", syncAfterRoute);
  installTitleObserver();
  scheduleCopyTargetSync();

  if (!document.getElementById("mflAgentWalletCopyStyles")) {
    const style = document.createElement("style");
    style.id = "mflAgentWalletCopyStyles";
    style.textContent = `
      .agentWalletCopyTarget {
        position: relative;
        display: inline-block;
        color: inherit;
        font: inherit;
        font-weight: inherit;
        line-height: inherit;
        text-decoration: none;
        cursor: pointer;
      }

      .agentWalletCopyTarget:hover,
      .agentWalletCopyTarget:focus-visible,
      .agentWalletCopyTarget:active {
        color: inherit;
        text-decoration: underline;
        outline: 0;
      }
    `;
    document.head.appendChild(style);
  }
})();
