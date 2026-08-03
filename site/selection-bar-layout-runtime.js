(() => {
  const VERSION = "1.120.5";
  const previousRuntime = window.__mflSelectionBarLayoutRuntime;

  previousRuntime?.destroy?.();

  const selectionBar = document.querySelector("#selectionBar");
  const originalParent = selectionBar?.parentNode || null;
  const originalNextSibling = selectionBar?.nextSibling || null;
  let bodyObserver = null;

  function pageContent() {
    return document.querySelector("#appShell main, main");
  }

  function attachToPageContent() {
    const main = pageContent();
    if (!(selectionBar instanceof HTMLElement) || !(main instanceof HTMLElement)) return;
    if (selectionBar.parentElement !== main) main.appendChild(selectionBar);
    selectionBar.dataset.contentLayoutVersion = VERSION;
  }

  let style = document.getElementById("selectionBarContentPositionStyles");
  if (!style) {
    style = document.createElement("style");
    style.id = "selectionBarContentPositionStyles";
    document.head.appendChild(style);
  }
  style.textContent = `
    #appShell main,
    body > main {
      position: relative !important;
    }

    #appShell main > #selectionBar.selectionBar,
    body > main > #selectionBar.selectionBar {
      position: absolute !important;
      left: 50% !important;
      right: auto !important;
      bottom: 22px !important;
      transform: translateX(-50%) !important;
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
