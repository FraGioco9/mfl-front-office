(() => {
  const VERSION = "1.119.35";
  const SOURCE_COMMIT = "55acaf30f69b393f70dc52dbdc7ce9802619f065";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/club-view-cache-runtime.js`;
  const activeShareButtons = new Set();

  function syncShareCursor() {
    document.documentElement.classList.toggle("evaluationShareBusy", activeShareButtons.size > 0);
  }

  function finishShareCursor(button) {
    activeShareButtons.delete(button);
    syncShareCursor();
  }

  function trackShareButton(button) {
    activeShareButtons.add(button);
    syncShareCursor();
    const startedAt = Date.now();

    const check = () => {
      const shareLoading = typeof state !== "undefined" && Boolean(state?.evaluationShareLoading);
      const buttonLoading = button.isConnected && button.disabled;
      if ((shareLoading || buttonLoading) && Date.now() - startedAt < 45000) {
        window.setTimeout(check, 50);
        return;
      }
      finishShareCursor(button);
    };

    window.requestAnimationFrame(check);
  }

  function installShareCursor() {
    let style = document.getElementById("evaluationShareBusyCursorStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "evaluationShareBusyCursorStyles";
      style.textContent = `
        html.evaluationShareBusy,
        html.evaluationShareBusy body,
        html.evaluationShareBusy body * {
          cursor: wait !important;
        }
      `;
      document.head.appendChild(style);
    }

    if (window.__mflEvaluationShareCursorBound) return;
    window.__mflEvaluationShareCursorBound = true;
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("#evaluationShareButton, .evaluationLoadShareButton");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      trackShareButton(button);
    }, true);
  }

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the club sorting runtime (${request.status}).`);
    }

    let source = request.responseText;
    const marker = 'const VERSION = "1.119.34";';
    if (!source.includes(marker)) {
      throw new Error("Could not locate the club sorting runtime version marker.");
    }
    source = source.replace(marker, `const VERSION = "${VERSION}";`);
    source += `\n//# sourceURL=mfl-club-sorting-runtime-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
    installShareCursor();
  } catch (error) {
    console.error(error?.message || "Could not initialize the club sorting runtime.");
    installShareCursor();
  }
})();
