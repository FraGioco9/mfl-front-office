(() => {
  "use strict";

  let captured = false;
  let armed = document.documentElement.dataset.mflReady === "true";
  let canonical = [];
  const input = () => document.getElementById("evaluationSearchInput");
  const results = () => document.getElementById("evaluationSearchResults");

  function currentButtons() {
    const container = results();
    if (!(container instanceof HTMLElement) || container.hidden) return [];
    return Array.from(container.querySelectorAll(":scope > .evaluationSearchResult"))
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
  }

  function playerId(button) {
    return String(button?.textContent || "").match(/#(\d+)/)?.[1] || "";
  }

  function prepend(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const id = playerId(button);
    canonical = [button, ...canonical.filter((candidate) => playerId(candidate) !== id)].slice(0, 5);
  }

  function sync() {
    const field = input();
    const container = results();
    if (!(field instanceof HTMLInputElement) || !(container instanceof HTMLElement)) return;

    if (!captured && armed && !field.value.trim()) {
      const rendered = currentButtons();
      if (rendered.length) {
        canonical = rendered;
        captured = true;
      }
      return;
    }

    if (!captured) return;

    if (!field.value.trim()) {
      queueMicrotask(() => {
        if (field.value.trim() || !canonical.length) return;
        container.replaceChildren(...canonical);
        container.hidden = false;
      });
      return;
    }

    if (container.hidden && document.activeElement instanceof HTMLButtonElement
      && document.activeElement.classList.contains("evaluationSearchResult")) {
      prepend(document.activeElement);
    }
  }

  window.addEventListener("mfl:ready", () => { armed = true; });
  const container = results();
  if (container instanceof HTMLElement) {
    new MutationObserver(sync).observe(container, {
      childList: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }
})();
