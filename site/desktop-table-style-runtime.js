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

  function syncAgentTitleInteraction() {
    routeFrame = 0;
    const title = titleElement();
    if (!title) return;
    const addressTarget = title.querySelector("[data-agent-wallet-copy]");
    const address = agentAddressFromPath();
    if (!(addressTarget instanceof HTMLElement) || !address) {
      title.removeAttribute("data-agent-wallet-copy");
      title.removeAttribute("data-note-tooltip");
      title.removeAttribute("role");
      title.removeAttribute("tabindex");
      title.removeAttribute("aria-label");
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

  function showCopyTooltip(target) {
    if (!(target instanceof HTMLElement)) return;
    try {
      if (typeof showPlayerNoteTooltip === "function") showPlayerNoteTooltip(target);
    } catch {}
  }

  function hideCopyTooltip(immediate = false) {
    try {
      if (typeof hidePlayerNoteTooltip === "function") hidePlayerNoteTooltip({ immediate });
    } catch {}
  }

  async function copyWalletAddress(target, event) {
    const address = normalizeAgentAddress(target?.dataset?.agentWalletCopy);
    if (!address) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    hideCopyTooltip(true);
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

  function onPointerOver(event) {
    const target = copyTargetFromEvent(event);
    if (target && !target.contains(event.relatedTarget)) showCopyTooltip(target);
  }

  function onPointerOut(event) {
    const target = copyTargetFromEvent(event);
    if (target && !target.contains(event.relatedTarget)) hideCopyTooltip();
  }

  function onFocusIn(event) {
    const target = copyTargetFromEvent(event);
    if (target) showCopyTooltip(target);
  }

  function onFocusOut(event) {
    if (copyTargetFromEvent(event)) hideCopyTooltip();
  }

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  window.addEventListener("mfl:ready", scheduleRouteSync);
  window.addEventListener("pageshow", scheduleRouteSync);
  window.addEventListener("popstate", scheduleRouteSync);
  syncAgentTitleInteraction();

  window.__mflDesktopTableStyleRuntime = Object.freeze({
    sync: scheduleRouteSync,
  });
})();
