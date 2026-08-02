(() => {
  const VERSION = "1.119.47";
  const previousRuntime = window.__mflSelectionBarLayoutRuntime;

  previousRuntime?.destroy?.();

  const selectionBar = document.querySelector("#selectionBar");
  const appShell = document.querySelector("#appShell");
  const originalParent = selectionBar?.parentNode || null;
  const originalNextSibling = selectionBar?.nextSibling || null;
  let bodyObserver = null;

  function attachToPageContent() {
    if (!(selectionBar instanceof HTMLElement) || !(appShell instanceof HTMLElement)) return;
    if (selectionBar.parentElement !== appShell) appShell.appendChild(selectionBar);
    selectionBar.dataset.contentLayoutVersion = VERSION;
  }

  let style = document.getElementById("selectionBarContentPositionStyles");
  if (!style) {
    style = document.createElement("style");
    style.id = "selectionBarContentPositionStyles";
    document.head.appendChild(style);
  }
  style.textContent = `
    body > #appShell {
      position: relative !important;
    }

    body > #appShell > #selectionBar.selectionBar {
      position: absolute !important;
      bottom: 22px !important;
    }
  `;

  if (document.body) {
    bodyObserver = new MutationObserver(attachToPageContent);
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function destroy() {
    bodyObserver?.disconnect();
    if (selectionBar instanceof HTMLElement && originalParent) {
      if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
        originalParent.insertBefore(selectionBar, originalNextSibling);
      } else {
        originalParent.appendChild(selectionBar);
      }
    }
  }

  window.__mflSelectionBarLayoutRuntime = {
    version: VERSION,
    destroy,
    sync: attachToPageContent,
  };

  attachToPageContent();
})();