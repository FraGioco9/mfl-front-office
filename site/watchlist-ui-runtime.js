(() => {
  "use strict";

  const STYLE_ID = "mflWatchlistUiRuntimeStyles";

  window.__mflWatchlistUiRuntime?.destroy?.();

  let tooltipTarget = null;
  let hideTimer = 0;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .watchlistDropdownRename::before,
      .watchlistDropdownRename::after { display: none !important; content: none !important; }
      .watchlistRenameTooltip {
        position: fixed;
        z-index: 2147483000;
        max-width: min(240px, calc(100vw - 16px));
        padding: 6px 9px;
        border-radius: 6px;
        background: #171922;
        color: #fff;
        font-size: 12px;
        line-height: 1.2;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transform: translateY(2px);
        transition: opacity 140ms ease, transform 140ms ease;
      }
      .watchlistRenameTooltip.visible { opacity: 1; transform: translateY(0); }
    `;
    document.head.appendChild(style);
  }

  function tooltip() {
    let element = document.getElementById("watchlistRenameTooltip");
    if (element) return element;
    element = document.createElement("div");
    element.id = "watchlistRenameTooltip";
    element.className = "watchlistRenameTooltip";
    element.setAttribute("role", "tooltip");
    element.textContent = "Rename";
    document.body.appendChild(element);
    return element;
  }

  function position() {
    const element = document.getElementById("watchlistRenameTooltip");
    if (!element || !tooltipTarget?.isConnected) return;
    const rect = tooltipTarget.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    element.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - box.width / 2, 8), Math.max(8, innerWidth - box.width - 8))}px`;
    element.style.top = `${Math.max(8, rect.top - box.height - 8)}px`;
  }

  function show(target) {
    if (!(target instanceof HTMLElement)) return;
    if (hideTimer) clearTimeout(hideTimer);
    tooltipTarget = target;
    target.removeAttribute("data-tooltip");
    const element = tooltip();
    position();
    requestAnimationFrame(() => {
      if (tooltipTarget === target && element.isConnected) element.classList.add("visible");
    });
  }

  function hide(immediate = false) {
    if (hideTimer) clearTimeout(hideTimer);
    const element = document.getElementById("watchlistRenameTooltip");
    if (!element) {
      tooltipTarget = null;
      return;
    }
    const remove = () => {
      element.remove();
      tooltipTarget = null;
      hideTimer = 0;
    };
    element.classList.remove("visible");
    if (immediate) remove();
    else hideTimer = window.setTimeout(remove, 120);
  }

  function renameButton(target) {
    if (!(target instanceof Element)) return null;
    const button = target.closest(".watchlistDropdownRename");
    return button instanceof HTMLElement ? button : null;
  }

  function onPointerOver(event) {
    const button = renameButton(event.target);
    if (button && !button.contains(event.relatedTarget)) show(button);
  }

  function onPointerOut(event) {
    const button = renameButton(event.target);
    if (button && !button.contains(event.relatedTarget)) hide();
  }

  function onFocusIn(event) {
    const button = renameButton(event.target);
    if (button) show(button);
  }

  function onFocusOut(event) {
    if (renameButton(event.target)) hide();
  }

  function onPointerDown(event) {
    if (renameButton(event.target)) hide(true);
  }

  function destroy() {
    if (hideTimer) clearTimeout(hideTimer);
    document.removeEventListener("pointerover", onPointerOver, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("focusout", onFocusOut, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("resize", position);
    window.removeEventListener("scroll", position, true);
    hide(true);
    document.getElementById(STYLE_ID)?.remove();
  }

  installStyles();
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
  window.__mflWatchlistUiRuntime = Object.freeze({ destroy });
})();