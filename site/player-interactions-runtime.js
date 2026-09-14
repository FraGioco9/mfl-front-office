(() => {
  "use strict";

  window.__mflPlayerInteractionsRuntime?.destroy?.();

  const PLAYER_VIEW_SCROLL_MEDIA = window.matchMedia("(max-width: 900px)");
  let playerAttributeViewScrollPathname = "";
  let playerAttributeViewScrollLeft = 0;
  let playerAttributeViewRestoreFrame = 0;
  let playerAttributeViewRestoring = false;
  let playerAttributeViewMutationObserver = null;

  function currentPlayerPathname() {
    const pathname = String(window.location.pathname || "").replace(/\/+$/, "") || "/";
    return /^\/players\/\d{1,20}$/i.test(pathname) ? pathname : "";
  }

  function compactPlayerPageName(value) {
    const fullName = String(value || "").trim().replace(/\s+/g, " ");
    if (!fullName) return "";
    return fullName.replace(/^(\S)[^\s]*\s+(?:.*\s)?(\S+)$/, "$1. $2");
  }

  function syncPlayerPageDetails() {
    const detail = document.getElementById("playerDetail");
    if (!(detail instanceof HTMLElement)) return false;
    const mobile = PLAYER_VIEW_SCROLL_MEDIA.matches;

    detail.querySelectorAll(".playerTitleName").forEach((target) => {
      if (!(target instanceof HTMLElement)) return;
      const rendered = String(target.textContent || "").trim();
      const stored = String(target.dataset.playerFullName || "").trim();
      let fullName = stored;
      if (!fullName || (rendered && rendered !== fullName && rendered !== compactPlayerPageName(fullName))) {
        fullName = rendered;
        target.dataset.playerFullName = fullName;
      }
      if (!fullName) return;
      const displayName = mobile ? compactPlayerPageName(fullName) : fullName;
      if (target.textContent !== displayName) target.textContent = displayName;
      if (target.getAttribute("aria-label") !== fullName) target.setAttribute("aria-label", fullName);
    });

    const playerId = detail.querySelector("#copyPlayerIdButton");
    if (playerId instanceof HTMLElement) {
      if (mobile) playerId.removeAttribute("data-tooltip");
      else playerId.dataset.tooltip = "Click to copy";
    }

    const listing = detail.querySelector(".playerTitle .listingCellContent");
    if (listing instanceof HTMLElement) {
      listing.classList.add("playerListingBadge");
      const price = String(listing.querySelector(".listingCellPrice")?.textContent || "").trim();
      if (mobile && price) {
        listing.dataset.tooltip = price;
        listing.setAttribute("role", "button");
        listing.tabIndex = 0;
        listing.setAttribute("aria-label", `Listing price ${price}`);
      } else {
        listing.removeAttribute("data-tooltip");
        listing.removeAttribute("role");
        listing.removeAttribute("tabindex");
        if (price) listing.setAttribute("aria-label", `For Sale at ${price}`);
      }
    }
    return true;
  }

  function currentPlayerAttributeViews() {
    const views = document.querySelector("#playerDetail .playerAttributeViews");
    return views instanceof HTMLElement ? views : null;
  }

  function syncPlayerAttributeViewScrollPath() {
    const pathname = currentPlayerPathname();
    if (pathname === playerAttributeViewScrollPathname) return pathname;
    playerAttributeViewScrollPathname = pathname;
    playerAttributeViewScrollLeft = 0;
    playerAttributeViewRestoring = false;
    if (playerAttributeViewRestoreFrame) cancelAnimationFrame(playerAttributeViewRestoreFrame);
    playerAttributeViewRestoreFrame = 0;
    return pathname;
  }

  function rememberPlayerAttributeViewScroll(views = currentPlayerAttributeViews()) {
    if (!PLAYER_VIEW_SCROLL_MEDIA.matches || !(views instanceof HTMLElement)) return;
    const pathname = syncPlayerAttributeViewScrollPath();
    if (!pathname || playerAttributeViewRestoring) return;
    playerAttributeViewScrollLeft = views.scrollLeft;
  }

  function applyPlayerAttributeViewScroll() {
    const pathname = syncPlayerAttributeViewScrollPath();
    if (!PLAYER_VIEW_SCROLL_MEDIA.matches || !pathname) return false;
    const views = currentPlayerAttributeViews();
    if (!(views instanceof HTMLElement)) return false;
    const maxScroll = Math.max(0, views.scrollWidth - views.clientWidth);
    const target = Math.min(maxScroll, Math.max(0, playerAttributeViewScrollLeft));
    if (Math.abs(views.scrollLeft - target) > 1) views.scrollLeft = target;
    return true;
  }

  function schedulePlayerAttributeViewScrollRestore() {
    if (!PLAYER_VIEW_SCROLL_MEDIA.matches || !syncPlayerAttributeViewScrollPath()) return;
    playerAttributeViewRestoring = true;
    if (playerAttributeViewRestoreFrame) cancelAnimationFrame(playerAttributeViewRestoreFrame);
    playerAttributeViewRestoreFrame = requestAnimationFrame(() => {
      playerAttributeViewRestoreFrame = 0;
      window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
      applyPlayerAttributeViewScroll();
      window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
      playerAttributeViewRestoring = false;
    });
  }

  function capturePlayerAttributeViewScroll(target) {
    if (!(target instanceof Element)) return;
    const button = target.closest("#playerDetail [data-player-attribute-view]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    const views = button.closest(".playerAttributeViews");
    if (!(views instanceof HTMLElement)) return;
    rememberPlayerAttributeViewScroll(views);
    queueMicrotask(schedulePlayerAttributeViewScrollRestore);
  }

  function onPlayerAttributeViewScroll(event) {
    const views = event.target;
    if (!(views instanceof HTMLElement) || !views.matches("#playerDetail .playerAttributeViews")) return;
    rememberPlayerAttributeViewScroll(views);
  }

  function playerAttributeViewControlsChanged(record) {
    if (record?.type !== "childList" || !(record.target instanceof HTMLElement)) return false;

    if (record.target.matches("#playerDetail .playerAttributeViews")) {
      return [...record.addedNodes, ...record.removedNodes].some((node) => {
        if (!(node instanceof HTMLElement) || node.hasAttribute("data-mfl-view-scroll-end-spacer")) return false;
        return node.matches(".playerAttributeViewButton, [data-player-attribute-view]")
          || Boolean(node.querySelector(".playerAttributeViewButton, [data-player-attribute-view]"));
      });
    }

    if (!record.target.matches("#playerDetail")) return false;
    return Array.from(record.addedNodes).some((node) => (
      node instanceof HTMLElement
      && node.matches(".playerGrid")
      && Boolean(node.querySelector(".playerAttributeViews"))
    ));
  }

  function initialPlayerViewCuePending() {
    const root = document.documentElement;
    return root.dataset.initialEntityRoute === "player"
      && !root.classList.contains("mflInitialRouteResolved")
      && !root.classList.contains("mflInitialRouteSuperseded");
  }

  function currentPlayerViewCueReady() {
    if (!PLAYER_VIEW_SCROLL_MEDIA.matches) return true;
    const views = currentPlayerAttributeViews();
    if (!(views instanceof HTMLElement) || views.getClientRects().length === 0) return false;
    const nativeOverflow = views.scrollWidth - views.clientWidth > 2;
    if (!nativeOverflow) return true;
    if (!views.classList.contains("mflViewsOverflowing")) return false;
    const shell = views.parentElement;
    if (!(shell instanceof HTMLElement) || !shell.classList.contains("viewsScrollerShell")) return false;
    const button = shell.querySelector(":scope > .viewsScrollButton.viewsScrollButtonRight");
    return button instanceof HTMLButtonElement
      && button.classList.contains("mflViewsScrollButtonVisible")
      && button.getAttribute("aria-hidden") === "false"
      && Boolean(String(views.style.boxShadow || "").trim());
  }

  function syncInitialPlayerViewCue() {
    if (!initialPlayerViewCuePending()) return true;
    const root = document.documentElement;
    root.dataset.playerFirstPaintCuesReady = "false";
    window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
    return currentPlayerViewCueReady();
  }

  function observePlayerAttributeViewRenders() {
    const detail = document.getElementById("playerDetail");
    if (!(detail instanceof HTMLElement) || typeof MutationObserver !== "function") return;
    playerAttributeViewMutationObserver?.disconnect();
    playerAttributeViewMutationObserver = new MutationObserver((records) => {
      syncPlayerPageDetails();
      if (!records.some(playerAttributeViewControlsChanged)) return;
      if (!syncInitialPlayerViewCue()) window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
      else if (!initialPlayerViewCuePending()) window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
      schedulePlayerAttributeViewScrollRestore();
    });
    playerAttributeViewMutationObserver.observe(detail, { childList: true, subtree: true, characterData: true });
  }

  function onPlayerViewScrollMediaChange(event) {
    syncPlayerPageDetails();
    if (event.matches) {
      syncPlayerAttributeViewScrollPath();
      return;
    }
    playerAttributeViewScrollLeft = 0;
    playerAttributeViewRestoring = false;
  }


  function onClick(event) {
    capturePlayerAttributeViewScroll(event.target);
  }

  syncPlayerAttributeViewScrollPath();
  syncPlayerPageDetails();
  observePlayerAttributeViewRenders();
  document.addEventListener("click", onClick, true);
  document.addEventListener("scroll", onPlayerAttributeViewScroll, true);
  PLAYER_VIEW_SCROLL_MEDIA.addEventListener("change", onPlayerViewScrollMediaChange);

  function destroy() {
    playerAttributeViewMutationObserver?.disconnect();
    playerAttributeViewMutationObserver = null;
    if (playerAttributeViewRestoreFrame) cancelAnimationFrame(playerAttributeViewRestoreFrame);
    playerAttributeViewRestoreFrame = 0;
    playerAttributeViewRestoring = false;
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("scroll", onPlayerAttributeViewScroll, true);
    PLAYER_VIEW_SCROLL_MEDIA.removeEventListener("change", onPlayerViewScrollMediaChange);
  }

  window.__mflPlayerInteractionsRuntime = Object.freeze({
    syncPlayerPageDetails,
    destroy,
  });
})();
