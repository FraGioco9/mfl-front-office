(() => {
  const mflWalletAddress = "0xff8d2bbed8164db0";

  function searchResultForMflWallet(target) {
    const result = target?.closest?.("a,button,[role='button'],li");
    if (!result || !result.closest("#searchModal,.searchResults,#playerSearchResults,[class*='searchResult']")) return null;

    const context = [result, result.closest("li"), result.parentElement]
      .filter(Boolean)
      .map((element) => `${element.textContent || ""} ${Array.from(element.attributes || []).map((attribute) => `${attribute.name}=${attribute.value}`).join(" ")}`.toLowerCase())
      .join(" ");

    return context.includes("mfl wallet") || context.includes(mflWalletAddress) ? result : null;
  }

  function onMflStatsView() {
    return window.location.pathname.toLowerCase() === "/mfl/stats"
      || (typeof state === "object" && state && (
        state.currentPage === "mflstats"
        || (state.currentPage === "mfl" && state.view === "stats")
      ));
  }

  async function openMflAttributes() {
    if (typeof closeSearch === "function") closeSearch();

    if (typeof setPage === "function") {
      await setPage("mfl", true, { view: "attributes", skipNavigationLoading: false });
    }

    if (typeof state === "object" && state) {
      state.currentPage = "mfl";
      state.view = "attributes";
      state.page = 1;
    }

    if (window.location.pathname.toLowerCase() !== "/mfl/attributes") {
      window.history.replaceState({}, "", "/mfl/attributes");
    }

    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof buildTableColGroup === "function") buildTableColGroup();
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false });
    else if (typeof renderTable === "function") renderTable();
  }

  document.addEventListener("click", (event) => {
    if (!onMflStatsView() || !searchResultForMflWallet(event.target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void openMflAttributes();
  }, true);
})();
