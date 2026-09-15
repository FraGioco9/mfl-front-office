const modalReturnFocus = new WeakMap();
const modalFocusTrapBound = new WeakSet();

function modalDialog(modal) {
  if (!(modal instanceof HTMLElement)) return null;
  const dialog = modal.querySelector(':scope > [role="dialog"], :scope > .mflDialog');
  return dialog instanceof HTMLElement ? dialog : null;
}

function modalFocusableElements(modal) {
  if (!(modal instanceof HTMLElement)) return [];
  /** @type {HTMLElement[]} */
  const focusable = [];
  modal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ).forEach((element) => {
    if (element instanceof HTMLElement
      && !element.hidden
      && element.getClientRects().length > 0
      && getComputedStyle(element).visibility !== "hidden") {
      focusable.push(element);
    }
  });
  return focusable;
}

function focusModalFallback(modal) {
  if (!(modal instanceof HTMLElement) || modal.hidden) return false;
  const active = document.activeElement;
  if (active instanceof Node && modal.contains(active)) return true;
  const target = modalFocusableElements(modal)[0] || modalDialog(modal);
  if (!(target instanceof HTMLElement)) return false;
  if (target === modalDialog(modal) && !target.hasAttribute("tabindex")) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

function syncModalBackgroundAccessibility() {
  const shell = document.getElementById("appShell");
  if (!(shell instanceof HTMLElement)) return false;
  const modalVisible = Array.from(document.querySelectorAll("body > .modalBackdrop:not([hidden])"))
    .some((candidate) => candidate instanceof HTMLElement && candidate.getClientRects().length > 0);
  shell.inert = modalVisible;
  if (modalVisible) shell.setAttribute("aria-hidden", "true");
  else shell.removeAttribute("aria-hidden");
  return modalVisible;
}

function bindModalFocusTrap(modal) {
  if (!(modal instanceof HTMLElement) || modalFocusTrapBound.has(modal)) return;
  modalFocusTrapBound.add(modal);
  modal.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || modal.hidden) return;
    const focusable = modalFocusableElements(modal);
    if (!focusable.length) {
      event.preventDefault();
      focusModalFallback(modal);
      return;
    }
    const active = document.activeElement;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!(active instanceof Node) || !modal.contains(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  });
}

function showModal(modal) {
  if (!modal) {
    return;
  }

  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement && !modal.contains(active)) {
    modalReturnFocus.set(modal, active);
  }
  bindModalFocusTrap(modal);
  modal.classList.remove("modalClosing", "modalOpen");
  modal.hidden = false;
  syncModalBackgroundAccessibility();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      modal.classList.add("modalOpen");
      focusModalFallback(modal);
    });
  });
}

function hideModal(modal, afterClose) {
  if (!modal || modal.hidden) {
    syncModalBackgroundAccessibility();
    if (typeof afterClose === "function") {
      afterClose();
    }
    return;
  }

  const returnFocus = modalReturnFocus.get(modal);
  const activeBeforeClose = document.activeElement;
  const restoreFocus = activeBeforeClose === document.body
    || activeBeforeClose === document.documentElement
    || (activeBeforeClose instanceof Node && modal.contains(activeBeforeClose));

  modal.classList.remove("modalOpen");
  modal.classList.add("modalClosing");
  window.setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove("modalClosing");
    modalReturnFocus.delete(modal);
    syncModalBackgroundAccessibility();
    if (restoreFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected && !returnFocus.closest("[inert]")) {
      returnFocus.focus({ preventScroll: true });
    }
    if (typeof afterClose === "function") {
      afterClose();
    }
  }, 180);
}

function setupBackdropClickClose(modal, closeCallback) {
  if (!modal || typeof closeCallback !== "function") {
    return;
  }

  let pointerStartedOnBackdrop = false;

  modal.addEventListener("pointerdown", (event) => {
    pointerStartedOnBackdrop = event.target === modal;
  });

  modal.addEventListener("click", (event) => {
    if (pointerStartedOnBackdrop && event.target === modal) {
      closeCallback();
    }

    pointerStartedOnBackdrop = false;
  });
}
