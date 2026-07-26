(() => {
  const VERSION = "1.149.68";
  const NOTES_MAX_LENGTH = 100;

  function applyRuntimeFixes() {
    const footer = document.querySelector(".siteFooter, footer");
    if (footer) {
      const versionLink = footer.querySelector("a[data-page='changelog']") || footer.querySelector("a");
      if (versionLink) {
        versionLink.textContent = `MFL Front Office v${VERSION}`;
      }
    }

    const changelogList = document.querySelector(".changelogList");
    if (changelogList && !changelogList.querySelector("[data-version='1.149.68']")) {
      const item = document.createElement("li");
      item.dataset.version = VERSION;
      item.innerHTML = `<span>v${VERSION}</span><p>Show the current version in the footer, limit Notes to 100 characters, and smooth sidebar table transitions</p>`;
      changelogList.prepend(item);
    }

    const notesInput = document.querySelector("#playerNotesInput");
    if (notesInput) {
      notesInput.maxLength = NOTES_MAX_LENGTH;
      if (notesInput.value.length > NOTES_MAX_LENGTH) {
        notesInput.value = notesInput.value.slice(0, NOTES_MAX_LENGTH);
      }
      const updateCounter = () => {
        const counter = document.querySelector("#playerNotesCount");
        if (counter) {
          counter.textContent = `${notesInput.value.length}/${NOTES_MAX_LENGTH}`;
        }
      };
      updateCounter();
      if (!notesInput.dataset.maxLengthBound) {
        notesInput.dataset.maxLengthBound = "true";
        notesInput.addEventListener("input", () => {
          if (notesInput.value.length > NOTES_MAX_LENGTH) {
            notesInput.value = notesInput.value.slice(0, NOTES_MAX_LENGTH);
          }
          updateCounter();
        });
      }
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .appShell, main, .pageView, .tableShell, .tableScroller, table, col,
    th, td, .playerLink, .agentLink, .copyIdButton {
      transition-property: width, min-width, max-width, grid-template-columns, transform, opacity;
      transition-duration: 180ms;
      transition-timing-function: ease;
    }
    .appShell.sidebarTransitioning .tableScroller,
    .appShell.sidebarTransitioning table,
    .appShell.sidebarTransitioning th,
    .appShell.sidebarTransitioning td,
    .appShell.sidebarTransitioning .playerLink,
    .appShell.sidebarTransitioning .agentLink {
      visibility: visible !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(applyRuntimeFixes);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const coreScript = document.createElement("script");
  coreScript.src = `/app-core.js?v=${VERSION}`;
  coreScript.async = false;
  coreScript.onload = applyRuntimeFixes;
  coreScript.onerror = () => console.error("MFL Front Office core application failed to load.");
  document.head.appendChild(coreScript);
})();
