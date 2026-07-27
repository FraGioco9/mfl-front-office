(() => {
  const mflWalletAddress = "0xff8d2bbed8164db0";

  function elementContext(element) {
    if (!element) return "";

    const text = String(element.textContent || "").trim().toLowerCase();
    const attributes = Array.from(element.attributes || [])
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join(" ")
      .toLowerCase();

    return `${text} ${attributes}`;
  }

  function clickedMflWallet(event) {
    const target = event?.target;
    if (!target?.closest) return false;

    // Inspect only the element that performs the navigation. Do not inspect the
    // whole composed path, because a page ancestor may contain "MFL Wallet"
    // even when an unrelated navigation control was clicked.
    const interactiveElement = target.closest(
      "a,button,[role='button'],[data-wallet-address],[data-agent-wallet],[data-wallet]",
    );

    if (interactiveElement) {
      const context = elementContext(interactiveElement);
      if (context.includes("mfl wallet") || context.includes(mflWalletAddress)) return true;
    }

    // Search results may use a non-interactive row as their click target.
    const searchContainer = target.closest(
      "#searchModal,.searchResults,#playerSearchResults,[class*='searchResult']",
    );
    if (!searchContainer) return false;

    const searchResult = target.closest(
      "li,[role='option'],[data-wallet-address],[data-agent-wallet],[data-wallet],.searchResult,[class*='searchResultItem']",
    );
    if (!searchResult || !searchContainer.contains(searchResult)) return false;

    const context = elementContext(searchResult);
    return context.includes("mfl wallet") || context.includes(mflWalletAddress);
  }

  document.addEventListener("click", (event) => {
    if (!clickedMflWallet(event)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (typeof closeSearch === "function") closeSearch();

    // Always open the MFL Wallet profile on Attributes. This intentionally
    // ignores the last saved MFL view, which may have been Stats.
    window.location.assign("/mfl/attributes");
  }, true);
})();
