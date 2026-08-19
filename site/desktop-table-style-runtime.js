(() => {
  "use strict";

  const TITLE_SELECTOR = "#tablePageTitle";
  let routeFrame = 0;

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

  function titleElement() {
    const title = document.querySelector(TITLE_SELECTOR);
    return title instanceof HTMLElement ? title : null;
  }

  function clearAgentCopyTarget(target) {
    if (!(target instanceof HTMLElement)) return;
    target.removeAttribute("data-agent-wallet-copy");
    target.removeAttribute("data-note-tooltip");
    target.removeAttribute("role");
    target.removeAttribute("tabindex");
    target.removeAttribute("aria-label");
  }

  function syncAgentTitleInteraction() {
    routeFrame = 0;
    const title = titleElement();
    if (!title) return;
    const addressTarget = title.querySelector("[data-agent-wallet-copy]");
    const address = agentAddressFromPath();
    if (!(addressTarget instanceof HTMLElement) || !address) {
      clearAgentCopyTarget(addressTarget);
      clearAgentCopyTarget(title);
      return;
    }

    addressTarget.dataset.agentWalletCopy = address;
    addressTarget.dataset.noteTooltip = "Click to copy wallet address";
    addressTarget.setAttribute("role", "button");
    addressTarget.setAttribute("tabindex", "0");
    addressTarget.setAttribute("aria-label", "Click to copy wallet address");
  }

  function scheduleRouteSync() {
    if (routeFrame) cancelAnimationFrame(routeFrame);
    routeFrame = requestAnimationFrame(syncAgentTitleInteraction);
  }

  function copyTargetFromEvent(event) {
    const target = event.target instanceof Element ? event.target.closest("[data-agent-wallet-copy]") : null;
    if (!(target instanceof HTMLElement)) return null;
    const address = normalizeAgentAddress(target.dataset.agentWalletCopy);
    return address && address === agentAddressFromPath() ? target : null;
  }

  async function copyWalletAddress(target, event) {
    const address = normalizeAgentAddress(target?.dataset?.agentWalletCopy);
    if (!address) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });
    target.blur?.();

    try {
      await navigator.clipboard.writeText(address);
      if (typeof showToast === "function") showToast("Wallet address copied.");
    } catch {
      if (typeof showToast === "function") showToast("Could not copy wallet address.");
    }
  }

  function onClick(event) {
    const target = copyTargetFromEvent(event);
    if (target) void copyWalletAddress(target, event);
    scheduleRouteSync();
  }

  function onKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = copyTargetFromEvent(event);
    if (target) void copyWalletAddress(target, event);
  }

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("mfl:ready", scheduleRouteSync);
  window.addEventListener("pageshow", scheduleRouteSync);
  window.addEventListener("popstate", scheduleRouteSync);
  syncAgentTitleInteraction();

  window.__mflDesktopTableStyleRuntime = Object.freeze({
    sync: scheduleRouteSync,
  });
})();
