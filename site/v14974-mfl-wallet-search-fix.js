(() => {
  const mflWalletAddress = "0xff8d2bbed8164db0";

  function clickedMflWallet(target) {
    if (!target) return false;

    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
    const candidates = [
      target.closest?.("a,button,[role='button'],li,div"),
      ...path,
    ].filter((element, index, elements) => element && element.nodeType === 1 && elements.indexOf(element) === index);

    return candidates.some((element) => {
      const text = String(element.textContent || "").trim().toLowerCase();
      const attributes = Array.from(element.attributes || [])
        .map((attribute) => `${attribute.name}=${attribute.value}`)
        .join(" ")
        .toLowerCase();
      const context = `${text} ${attributes}`;
      return context.includes("mfl wallet") || context.includes(mflWalletAddress);
    });
  }

  function onMflStatsView() {
    const pathname = window.location.pathname.toLowerCase().replace(/\/$/, "");
    return pathname === "/mfl/stats"
      || (typeof state === "object" && state && (
        state.currentPage === "mflstats"
        || (state.currentPage === "mfl" && state.view === "stats")
      ));
  }

  document.addEventListener("click", (event) => {
    if (!onMflStatsView() || !clickedMflWallet(event.target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (typeof closeSearch === "function") closeSearch();

    // A full route navigation lets the app initialise the Attributes view and
    // load its table through the same path used on a direct page visit.
    window.location.assign("/mfl/attributes");
  }, true);
})();