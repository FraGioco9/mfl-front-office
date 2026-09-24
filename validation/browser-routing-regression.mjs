import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const siteDirectory = resolve(fileURLToPath(new URL("../", import.meta.url)));
const generatedAt = "2026-09-09T00:00:00.000Z";
const browserClubLogo9001 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%23112233'/%3E%3C/svg%3E";
const browserClubLogo9002 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%23223344'/%3E%3C/svg%3E";
const testWatchlistId = "browser1";
const testPlayer = Object.freeze({
  player_id: 1,
  wallet_address: "0x2222222222222222",
  wallet_name: "Browser Agent",
  name: "Browser Player",
  listing_price: null,
  positions: "ST",
  age: 23,
  nationality: "Italy",
  retirement_years: 5,
  owned_since: 1700000000,
  player_seasons: 5,
  overall: 80,
  pace: 90,
  shooting: 82,
  passing: 74,
  dribbling: 86,
  defense: 40,
  physical: 78,
  goalkeeping: 10,
  height: 185,
  preferred_foot: "Right",
  active_contract_revenue_share: 1250,
  active_contract_nb_matches: 12,
  active_contract_club_id: "browser-club",
  active_contract_club_name: "Browser FC",
  active_contract_club_division: 2,
});
const searchColumns = [
  "player_id",
  "name",
  "positions",
  "age",
  "nationality",
  "overall",
  "wallet_address",
  "wallet_name",
  "active_contract_club_id",
  "active_contract_club_name",
  "retirement_years",
  "player_seasons",
  "active_contract_revenue_share",
];
const publicColumns = [
  "player_id",
  "wallet_address",
  "wallet_name",
  "name",
  "positions",
  "age",
  "nationality",
  "retirement_years",
  "owned_since",
  "player_seasons",
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
  "goalkeeping",
  "height",
  "preferred_foot",
  "active_contract_revenue_share",
  "active_contract_nb_matches",
  "active_contract_club_id",
  "active_contract_club_name",
  "active_contract_club_division",
];
const pageColumns = [
  "player_id",
  "wallet_address",
  "wallet_name",
  "name",
  "listing_price",
  "positions",
  "age",
  "nationality",
  "retirement_years",
  "owned_since",
  "player_seasons",
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
  "goalkeeping",
  "height",
  "preferred_foot",
  "active_contract_revenue_share",
  "active_contract_nb_matches",
  "active_contract_club_id",
  "active_contract_club_name",
  "active_contract_club_division",
];

function rowForColumns(columns) {
  return columns.map((column) => testPlayer[column] ?? null);
}

const browserTestSource = String.raw`(() => {
  "use strict";

  const filteredEmpty = window.location.search === "?overall.gte=99";
  const linkedTableRefresh = window.location.search === "?overall.gte=79&sort=age&direction=asc";
  const expectedBrowserClubLogo = ${JSON.stringify(browserClubLogo9001)};
  const scenario = window.location.pathname === "/privacy"
    ? "stale"
    : window.location.pathname.startsWith("/database/")
      ? (linkedTableRefresh ? "database-linked-state" : filteredEmpty ? "database-empty" : "database")
      : window.location.pathname.startsWith("/players/")
        ? "player"
        : window.location.pathname.startsWith("/watchlist/")
          ? (filteredEmpty ? "watchlist-empty" : "watchlist")
          : window.location.pathname === "/my-clubs"
            ? (window.location.hash === "#opted-in"
                ? "myclubs-in"
                : window.location.hash === "#competition-fail"
                  ? "myclubs-competition-fail"
                  : window.location.hash === "#stale-proof"
                    ? "myclubs-stale"
                    : "myclubs-out")
            : window.location.pathname === "/mfl/stats"
              ? "mflstats"
              : window.location.pathname === "/planner"
                ? (window.location.search === "?club=9001" ? "planner-selected" : window.location.hash === "#opted-out" ? "planner-out" : "planner")
                : "unknown";

  if (scenario === "planner-selected" || scenario === "planner-out") {
    if (scenario === "planner-selected") localStorage.setItem("mfl-planner-formation-v1:9001", "4231");
    localStorage.setItem("mfl-club-display-data-v1", JSON.stringify({
      "9001": {
        clubId: "9001", name: "Browser Club",
        divisionName: "Gold", divisionColor: "#ffd23e",
        primaryColor: "#112233", secondaryColor: "#445566",
        city: "Bologna", nation: "ITALY",
      },
    }));
  }

  const myClubsRequests = { ownership: 0, competitions: 0 };
  let mflStatsSummaryRequests = 0;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.origin);
    if (requestUrl.searchParams.get("mode") === "my-clubs") myClubsRequests.ownership += 1;
    if (requestUrl.searchParams.get("mode") === "my-clubs-competitions") myClubsRequests.competitions += 1;
    if (requestUrl.searchParams.get("mode") === "mfl-stats-summary") mflStatsSummaryRequests += 1;
    if (!["myclubs-competition-fail", "myclubs-stale", "planner", "planner-selected"].includes(scenario)) return originalFetch(input, init);
    const headers = new Headers(init?.headers || {});
    headers.set("x-browser-regression-scenario", scenario);
    return originalFetch(input, { ...init, headers });
  };

  const testWallet = "0x1111111111111111";
  const testWatchlistId = "browser1";
  const expectedPlayerName = "Browser Player";
  const errors = [];
  let parserSnapshot = null;
  let loadingSkeletonHeight = 0;
  const linkedTablePaintHistory = { filterCounts: [], sortStates: [] };
  let linkedTablePaintSampling = linkedTableRefresh;

  const sampleLinkedTablePaint = () => {
    if (!linkedTablePaintSampling) return;
    const filterSummary = document.getElementById("filterSummary");
    if (filterSummary instanceof HTMLElement && !filterSummary.hidden) {
      const count = String(filterSummary.textContent || "").trim();
      if (count && linkedTablePaintHistory.filterCounts.at(-1) !== count) {
        linkedTablePaintHistory.filterCounts.push(count);
      }
    }
    const sortedHeader = document.querySelector("#tableHead th[aria-sort]");
    if (sortedHeader instanceof HTMLTableCellElement) {
      const stateValue = String(sortedHeader.dataset.tableColumn || "") + ":" + String(sortedHeader.getAttribute("aria-sort") || "");
      if (stateValue !== ":" && linkedTablePaintHistory.sortStates.at(-1) !== stateValue) {
        linkedTablePaintHistory.sortStates.push(stateValue);
      }
    }
    requestAnimationFrame(sampleLinkedTablePaint);
  };
  if (linkedTablePaintSampling) requestAnimationFrame(sampleLinkedTablePaint);

  if (["watchlist", "watchlist-empty", "myclubs-in", "myclubs-competition-fail", "myclubs-stale", "planner", "planner-selected"].includes(scenario)) {
    const proof = {
      type: "session",
      address: testWallet,
      message: "MFL Front Office Dapper Opt-In",
      appIdentifier: "MFL Front Office Dapper Opt-In",
      signingAddress: testWallet,
      nonce: "",
      signatures: [],
    };
    localStorage.setItem("mfl-linked-wallet-v1", testWallet);
    localStorage.setItem("mfl-linked-wallet-proof-v1", JSON.stringify(proof));
    if (scenario === "watchlist" || scenario === "watchlist-empty") {
      localStorage.setItem(
        "mfl-wallet-watchlist-v1:" + testWallet,
        JSON.stringify([{ id: testWatchlistId, name: "Browser List", playerIds: ["1"] }]),
      );
    }
  }

  if (scenario === "player") {
    const knownValues = {
      player_id: { raw: 1, display: "1" },
      name: { raw: expectedPlayerName, display: expectedPlayerName },
      positions: { raw: "ST", display: "ST" },
      age: { raw: 23, display: "23" },
      nationality: { raw: "Italy", display: "Italy" },
      overall: { raw: 80, display: "80" },
      goalkeeping: { raw: 10, display: "10" },
      height: { raw: 185, display: "185" },
      preferred_foot: { raw: "Right", display: "Right" },
      retirement_years: { raw: 5, display: "5" },
    };
    sessionStorage.setItem(
      "mfl-player-first-paint-v1:1",
      JSON.stringify({
        playerId: "1",
        name: expectedPlayerName,
        positions: ["ST"],
        overall: "80",
        knownValues,
      }),
    );
  }

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    errors.push(args.map((value) => String(value)).join(" "));
    originalConsoleError(...args);
  };
  window.addEventListener("error", (event) => {
    errors.push(String(event.error?.stack || event.message || "window error"));
  });
  window.addEventListener("unhandledrejection", (event) => {
    errors.push(String(event.reason?.stack || event.reason || "unhandled rejection"));
  });

  document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    parserSnapshot = {
      initialPage: String(root.dataset.initialPage || ""),
      initialTablePage: String(root.dataset.initialTablePage || ""),
      initialTableView: String(root.dataset.initialTableView || ""),
      initialEntityRoute: String(root.dataset.initialEntityRoute || ""),
      initialRoutePage: String(root.dataset.initialRoutePage || ""),
      initialRouteShell: String(root.dataset.initialRouteShell || ""),
      storedWalletOptIn: String(root.dataset.storedWalletOptIn || ""),
      homeHidden: hidden("#homePage"),
      lockedHidden: hidden("#myPlayersLockedPage"),
      myClubsHidden: hidden("#myClubsPage"),
      myClubsSkeletons: document.querySelectorAll("#myClubsGrid .myClubCardLoading").length,
      plannerHidden: hidden("#plannerPage"),
      plannerLockedTitle: text("#optInLockedTitle"),
      plannerLockedMessage: text("#optInLockedMessage"),
      plannerLockedHidden: hidden("#myPlayersLockedPage"),
      plannerTitle: text("#plannerPage .tablePageTitle"),
      plannerTeamSelectorHidden: hidden("#plannerTeamSelector"),
      plannerSelectedTeamHidden: hidden("#plannerSelectedTeam"),
      plannerWorkspaceHidden: hidden("#plannerWorkspace"),
      plannerRosterSkeletons: document.querySelectorAll("#plannerRosterBody .plannerRosterSkeleton").length,
      plannerTeamLogoSrc: String(document.getElementById("plannerTeamLogo")?.getAttribute("src") || ""),
      plannerFormation: String(document.getElementById("plannerFormationSelect")?.value || ""),
      plannerFormationEnhanced: document.getElementById("plannerFormationSelect")?.getAttribute("data-mfl-dropdown-enhanced") || "",
      plannerFormationAlignment: getComputedStyle(document.getElementById("plannerFormationSelect")).alignItems,
      plannerFormationPaddingRight: getComputedStyle(document.getElementById("plannerFormationSelect")).paddingRight,
      plannerFormationSpots: document.querySelectorAll("#plannerFormationPositions .plannerFormationSpot").length,
      plannerFormationSpotRows: Array.from(document.querySelectorAll("#plannerFormationPositions .plannerFormationSpot"), spot => spot.style.top),
      plannerFormationSpotPositions: Array.from(document.querySelectorAll("#plannerFormationPositions .plannerFormationSpot"), spot => spot.dataset.position),
      plannerFormationTokenCount: document.querySelectorAll("#plannerFormationPositions [data-slot-token='true']").length,
      plannerFormationRingSegments: document.querySelectorAll("#plannerFormationPositions .plannerFormationTokenRing path").length,
      plannerFormationPlusPaths: document.querySelectorAll("#plannerFormationPositions .plannerFormationTokenPlus path").length,
      plannerFormationBadgeCount: document.querySelectorAll("#plannerFormationPositions .plannerFormationInstructionsBadge, #plannerFormationPositions .plannerFormationInstructionsIcon").length,
      plannerPitchBackground: getComputedStyle(document.querySelector(".plannerPitch")).backgroundImage,
      plannerTeamIdText: text("#plannerTeamId"),
      plannerTeamLocationText: text("#plannerTeamLocation"),
      plannerTeamFlagSlot: document.querySelector("#plannerTeamLocation .clubLocationFlag") !== null,
      plannerTeamFlagSrc: document.querySelector("#plannerTeamLocation .clubLocationFlag")?.getAttribute("src") || "",
      plannerTeamFlagTooltip: document.querySelector("#plannerTeamLocation .clubLocationFlag")?.getAttribute("data-tooltip") || "",
      plannerTeamNameText: text("#plannerTeamName"),
      plannerTeamDivisionText: text("#plannerTeamDivision"),
      plannerTeamDivisionColor: document.getElementById("plannerTeamDivision")?.style.color || "",
      plannerTeamPrimaryColor: document.getElementById("plannerTeamCard")?.style.getPropertyValue("--my-club-primary") || "",
      plannerTeamSecondaryColor: document.getElementById("plannerTeamCard")?.style.getPropertyValue("--my-club-secondary") || "",
      plannerTeamIdTop: document.getElementById("plannerTeamId")?.getBoundingClientRect().top || 0,
      plannerSelectedTeamRight: document.getElementById("plannerSelectedTeam")?.getBoundingClientRect().right || 0,
      plannerTeamCardRight: document.getElementById("plannerTeamCard")?.getBoundingClientRect().right || 0,
      plannerTeamCardBottom: document.getElementById("plannerTeamCard")?.getBoundingClientRect().bottom || 0,
      plannerTeamCardHeight: document.getElementById("plannerTeamCard")?.getBoundingClientRect().height || 0,
      plannerTeamNameFontSize: getComputedStyle(document.getElementById("plannerTeamName")).fontSize,
      plannerTeamLogoMaxWidth: getComputedStyle(document.getElementById("plannerTeamLogo")).maxWidth,
      plannerTeamLogoMaxHeight: getComputedStyle(document.getElementById("plannerTeamLogo")).maxHeight,
      plannerClearButtonLeft: document.getElementById("plannerTeamClearButton")?.getBoundingClientRect().left || 0,
      plannerClearButtonTop: document.getElementById("plannerTeamClearButton")?.getBoundingClientRect().top || 0,
      plannerClearButtonRight: document.getElementById("plannerTeamClearButton")?.getBoundingClientRect().right || 0,
      bodyPage: String(document.body.dataset.page || ""),
      filterCount: text("#filterSummary"),
      sortedColumn: String(document.querySelector("#tableHead th[aria-sort]")?.dataset?.tableColumn || ""),
      sortDirection: String(document.querySelector("#tableHead th[aria-sort]")?.getAttribute("aria-sort") || ""),
      title: document.title,
    };
  }, { once: true });

  const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const finish = (status, detail) => {
    const previous = document.querySelector("#mflBrowserRoutingRegression");
    previous?.remove();
    const result = document.createElement("pre");
    result.id = "mflBrowserRoutingRegression";
    result.dataset.status = status;
    result.textContent = detail;
    document.body.appendChild(result);
  };
  const text = (selector) => String(document.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim();
  const hidden = (selector) => {
    const element = document.querySelector(selector);
    return !(element instanceof HTMLElement) || element.hidden || getComputedStyle(element).display === "none";
  };

  function assertElementWithinViewport(selector, viewportWidth) {
    const element = document.querySelector(selector);
    assert(element instanceof HTMLElement, selector + " is missing from the shared layout.");
    const rect = element.getBoundingClientRect();
    assert(rect.width > 0, selector + " has no visible width.");
    assert(
      rect.left >= -0.5 && rect.right <= viewportWidth + 0.5,
      selector + " overflows the viewport: " + JSON.stringify({ left: rect.left, right: rect.right, width: rect.width, viewportWidth }),
    );
  }

  function assertVisibleElementInside(selector, ancestorSelector) {
    const element = document.querySelector(selector);
    const ancestor = document.querySelector(ancestorSelector);
    assert(element instanceof Element, selector + " is missing.");
    assert(ancestor instanceof HTMLElement, ancestorSelector + " is missing.");
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (
      style.display === "none"
      || style.visibility === "hidden"
      || Number(style.opacity || "1") === 0
      || (rect.width <= 1.5 && rect.height <= 1.5)
    ) return;

    const ancestorRect = ancestor.getBoundingClientRect();
    assert(
      rect.left >= ancestorRect.left - 0.5
        && rect.right <= ancestorRect.right + 0.5,
      selector + " is horizontally clipped by " + ancestorSelector + ": " + JSON.stringify({
        element: { left: rect.left, right: rect.right, width: rect.width },
        ancestor: { left: ancestorRect.left, right: ancestorRect.right, width: ancestorRect.width },
      }),
    );
  }

  function assertSharedChromeGeometry() {
    const viewportWidth = document.documentElement.clientWidth;
    assert(
      document.documentElement.scrollWidth <= viewportWidth + 1,
      "The document is wider than the viewport: " + JSON.stringify({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth,
      }),
    );

    for (const selector of [
      ".topbar",
      "#openSearchButton",
      ".headerControls",
      ".stats",
      ".stats > div:first-child",
      ".stats > div:last-child",
      "#themeButton",
      "#accountMenu",
      "#accountButton",
      "#appShell > main",
      ".siteFooterDetails",
      ".siteFooterDetailsInner",
    ]) {
      if (viewportWidth <= 1366 && selector.startsWith(".stats")) {
        assert(hidden(".stats"), "Mobile header counters should use the compact hidden state.");
        continue;
      }
      assertElementWithinViewport(selector, viewportWidth);
    }

    for (const [selector, ancestorSelector] of [
      [".brandLink", ".topbar > :first-child"],
      [".searchLabel", "#openSearchButton"],
      [".searchLabelText", "#openSearchButton"],
      [".searchShortcut", "#openSearchButton"],
      [".stats > div:first-child > span", ".stats > div:first-child"],
      [".stats > div:first-child > label", ".stats > div:first-child"],
      [".stats > div:last-child > span", ".stats > div:last-child"],
      [".stats > div:last-child > label", ".stats > div:last-child"],
      ["#themeButton .themeModeIcon:not([hidden])", "#themeButton"],
      ["#accountButton .accountButtonIcon", "#accountButton"],
      ["#accountButton > span", "#accountButton"],
    ]) {
      assertVisibleElementInside(selector, ancestorSelector);
    }

    if (scenario === "player") {
      const main = document.querySelector("#appShell > main");
      assert(main instanceof HTMLElement, "Player main shell is missing.");
      const playerGeometrySelectors = [
        ".playerPage",
        ".playerDetail",
        ".playerHero",
        ".playerHeroMedia",
        ".playerHeroIdentity",
        ".playerHeroActions",
        ".playerHeroActionMenu",
        ".playerGrid",
        ".playerStack",
        ".playerPanel",
        ".pitchPanel",
        "#playerDetail .pitch",
      ];
      if (main.scrollWidth > main.clientWidth + 1) {
        const geometry = Object.fromEntries(playerGeometrySelectors.map((selector) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) return [selector, null];
          const rect = element.getBoundingClientRect();
          return [selector, {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            display: getComputedStyle(element).display,
            gridTemplateColumns: getComputedStyle(element).gridTemplateColumns,
          }];
        }));
        throw new Error("Player route overflows the main viewport: " + JSON.stringify({
          scrollWidth: main.scrollWidth,
          clientWidth: main.clientWidth,
          geometry,
        }));
      }
      for (const selector of playerGeometrySelectors) {
        assertElementWithinViewport(selector, viewportWidth);
      }

      if (viewportWidth >= 901 && viewportWidth <= 1366) {
        const hero = document.querySelector(".playerHero");
        const grid = document.querySelector(".playerGrid");
        assert(hero instanceof HTMLElement, "Intermediate Player hero is missing.");
        assert(grid instanceof HTMLElement, "Intermediate Player grid is missing.");
        const heroStyle = getComputedStyle(hero);
        const gridStyle = getComputedStyle(grid);
        assert(
          heroStyle.display === "grid",
          "Intermediate Player hero must use the two-row responsive layout: " + JSON.stringify({
            viewportWidth,
            display: heroStyle.display,
            gridTemplateAreas: heroStyle.gridTemplateAreas,
          }),
        );
        const gridColumns = gridStyle.gridTemplateColumns
          .split(" ")
          .map((value) => value.trim())
          .filter(Boolean);
        assert(
          gridColumns.length === 1,
          "Intermediate Player profile/pitch must use one content column: " + JSON.stringify({
            viewportWidth,
            gridTemplateColumns: gridStyle.gridTemplateColumns,
          }),
        );

        const media = document.querySelector(".playerHeroMedia");
        const identity = document.querySelector(".playerHeroIdentity");
        const titleName = document.querySelector(".playerHeroIdentity .playerTitleName");
        assert(media instanceof HTMLElement, "Intermediate Player media is missing.");
        assert(identity instanceof HTMLElement, "Intermediate Player identity is missing.");
        assert(titleName instanceof HTMLElement, "Intermediate Player title is missing.");
        const mediaRect = media.getBoundingClientRect();
        const identityRect = identity.getBoundingClientRect();
        const titleRect = titleName.getBoundingClientRect();
        assert(
          identityRect.left - mediaRect.right <= 16,
          "Intermediate Player identity is pushed too far right of the media: " + JSON.stringify({
            viewportWidth,
            mediaRight: mediaRect.right,
            identityLeft: identityRect.left,
            gap: identityRect.left - mediaRect.right,
          }),
        );
        assert(
          Math.abs(titleRect.left - identityRect.left) <= 2,
          "Intermediate Player name must align to the identity left edge: " + JSON.stringify({
            viewportWidth,
            titleLeft: titleRect.left,
            identityLeft: identityRect.left,
          }),
        );
      }
    }
  }

  async function waitFor(predicate, message, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await delay(25);
    }
    throw new Error(message);
  }

  function assertInitialFirstPaint() {
    assert(parserSnapshot, "Parser-time first-paint snapshot was not captured.");
    if (scenario === "database" || scenario === "database-empty" || scenario === "database-linked-state") {
      assert(parserSnapshot.initialPage === "database/attributes", "Database first paint has the wrong initial path.");
      assert(parserSnapshot.initialTablePage === "database", "Database first paint has the wrong table-page owner.");
      assert(parserSnapshot.initialTableView === "attributes", "Database first paint has the wrong view.");
      if (scenario === "database-linked-state") {
        assert(parserSnapshot.filterCount === "1", "Linked Database parser first paint exposed the wrong filter count: " + parserSnapshot.filterCount);
        assert(parserSnapshot.sortedColumn === "age", "Linked Database parser first paint sorted the wrong column: " + parserSnapshot.sortedColumn);
        assert(parserSnapshot.sortDirection === "ascending", "Linked Database parser first paint exposed the wrong sort direction: " + parserSnapshot.sortDirection);
      }
    } else if (scenario === "player") {
      assert(parserSnapshot.initialPage === "players/1", "Player first paint has the wrong initial path.");
      assert(parserSnapshot.initialEntityRoute === "player", "Player first paint has the wrong entity owner.");
      assert(parserSnapshot.title === expectedPlayerName + " - MFL Front Office", "Player parser-time title did not use the cached full name.");
    } else if (scenario === "watchlist" || scenario === "watchlist-empty") {
      assert(
        parserSnapshot.initialPage === "watchlist/" + testWatchlistId + "/current-season",
        "Watchlist first paint has the wrong initial path.",
      );
      assert(parserSnapshot.initialTablePage === "watchlist", "Watchlist first paint has the wrong table-page owner.");
      assert(parserSnapshot.initialTableView === "current", "Watchlist first paint has the wrong view.");
      assert(parserSnapshot.storedWalletOptIn === "true", "Watchlist first paint did not recognize the stored opt-in.");
    } else if (scenario === "myclubs-out" || scenario === "myclubs-in" || scenario === "myclubs-competition-fail" || scenario === "myclubs-stale") {
      const optedIn = scenario !== "myclubs-out";
      assert(parserSnapshot.initialPage === "my-clubs", "My Clubs first paint has the wrong initial path.");
      assert(parserSnapshot.initialRoutePage === "my-clubs", "My Clubs canonical first-paint route owner is wrong.");
      assert(
        parserSnapshot.initialRouteShell === (optedIn ? "myClubsPage" : "myPlayersLockedPage"),
        "My Clubs canonical first-paint shell is wrong: " + parserSnapshot.initialRouteShell,
      );
      assert(parserSnapshot.storedWalletOptIn === (optedIn ? "true" : "false"), "My Clubs stored opt-in state is wrong.");
      assert(parserSnapshot.homeHidden === true, "My Clubs direct first paint exposed Home.");
      assert(
        optedIn ? parserSnapshot.myClubsHidden === false : parserSnapshot.lockedHidden === false,
        "My Clubs direct first paint did not expose its destination shell.",
      );
      if (optedIn) {
        assert(parserSnapshot.myClubsSkeletons === 0, "My Clubs first paint must not guess a club-card count before ownership data arrives.");
      }
    } else if (scenario === "mflstats") {
      assert(parserSnapshot.initialPage === "mfl/stats", "MFL Stats first paint has the wrong initial path.");
      assert(parserSnapshot.initialTablePage === "mfl", "MFL Stats first paint has the wrong table-page owner.");
      assert(parserSnapshot.initialTableView === "stats", "MFL Stats first paint has the wrong view.");
    } else if (scenario === "planner-out") {
      assert(parserSnapshot.initialPage === "planner", "Opted-out Planner first paint resolved the wrong route.");
      assert(parserSnapshot.storedWalletOptIn === "false" && parserSnapshot.initialRouteShell === "myPlayersLockedPage", "Opted-out Planner must choose the locked shell at first paint.");
      assert(parserSnapshot.plannerHidden && !parserSnapshot.plannerLockedHidden && parserSnapshot.plannerLockedTitle === "Planner", "Opted-out Planner displayed its private workspace at first paint.");
      assert(parserSnapshot.plannerTeamIdText === "" && parserSnapshot.plannerTeamNameText === "", "Opted-out Planner exposed cached club identity.");
    } else if (scenario === "planner" || scenario === "planner-selected") {
      assert(parserSnapshot.initialPage === "planner", "Planner first paint has the wrong initial path.");
      assert(parserSnapshot.bodyPage === "planner", "Planner first paint has the wrong body page owner: " + parserSnapshot.bodyPage);
      assert(parserSnapshot.plannerHidden === false, "Planner page is still hidden at parser-time first paint.");
      assert(parserSnapshot.plannerTitle === "Planner", "Planner parser-time heading is wrong: " + parserSnapshot.plannerTitle);
      assert(parserSnapshot.title === "Planner - MFL Front Office", "Planner parser-time browser title is wrong: " + parserSnapshot.title);
      if (scenario === "planner-selected") {
        assert(parserSnapshot.plannerTeamSelectorHidden === true, "Selected Planner first paint exposed the Team search.");
        assert(parserSnapshot.plannerSelectedTeamHidden === false, "Selected Planner first paint did not expose the club identity.");
        assert(parserSnapshot.plannerWorkspaceHidden === false, "Selected Planner first paint did not expose the workspace.");
        assert(parserSnapshot.plannerRosterSkeletons === 56, "Selected Planner first paint did not expose the full roster loading skeleton.");
        assert(parserSnapshot.plannerTeamLogoSrc.includes("/9001/logo.webp"), "Selected Planner first paint did not expose the club logo URL.");
        assert(parserSnapshot.plannerFormation === "4231" && parserSnapshot.plannerFormationSpots === 11, "Selected Planner first paint must restore the cached 4-2-3-1 before hydration.");
        assert(Number.parseFloat(parserSnapshot.plannerFormationSpotRows[0]) === 78 && Number.parseFloat(parserSnapshot.plannerFormationSpotRows[9]) === 18 && parserSnapshot.plannerFormationSpotRows[10] === "92%", "Planner first paint must draw defenders near the goalkeeper and attackers at the top.");
        assert(JSON.stringify(parserSnapshot.plannerFormationSpotPositions) === JSON.stringify(["LB","CB","CB","RB","CDM","CDM","LM","CAM","RM","ST","GK"]), "4-2-3-1 first paint must label the confirmed position slots.");
        assert(parserSnapshot.plannerFormationTokenCount === 11 && parserSnapshot.plannerFormationRingSegments === 132 && parserSnapshot.plannerFormationPlusPaths === 22 && parserSnapshot.plannerFormationBadgeCount === 0, "Planner first paint must include eleven segmented-plus circles without instruction badges.");
        assert(parserSnapshot.plannerPitchBackground.includes("pitch-background.svg"), "Planner must paint the shared SVG pitch before hydration.");
        assert(parserSnapshot.plannerFormationEnhanced === "true", "Planner Formation must use the site's canonical dropdown styling from first paint.");
        assert(parserSnapshot.plannerFormationAlignment === "center", "The selected Formation label must be vertically centered from first paint.");
        assert(parserSnapshot.plannerFormationPaddingRight === "10px", "The Formation chevron must use the standard right inset from first paint.");
        assert(parserSnapshot.plannerTeamIdText === "Club #9001", "Selected Planner first paint must render Club #ID in the Club-page position.");
        assert(parserSnapshot.plannerTeamLocationText === "Bologna, Italy", "Planner first paint must show cached city and normalized nation.");
        assert(parserSnapshot.plannerTeamFlagSlot, "Planner first paint must reserve the nationality flag position.");
        assert(parserSnapshot.plannerTeamFlagSrc.endsWith("/1f1ee-1f1f9.svg"), "Planner must render the real cached Italian flag at first paint.");
        assert(parserSnapshot.plannerTeamFlagTooltip === "Italy", "Planner first-paint flag must preserve the canonical nationality tooltip.");
        assert(parserSnapshot.plannerTeamNameText === "Browser Club", "Planner first paint must use the cached Club name.");
        assert(parserSnapshot.plannerTeamDivisionText === "Gold", "Planner first paint must use the cached Club division.");
        assert(parserSnapshot.plannerTeamDivisionColor === "rgb(255, 210, 62)", "Planner first paint must use the cached division colour.");
        assert(parserSnapshot.plannerTeamPrimaryColor === "#112233" && parserSnapshot.plannerTeamSecondaryColor === "#445566", "Planner first paint must apply both cached Club colours.");
        assert(Math.abs(parserSnapshot.plannerSelectedTeamRight - parserSnapshot.plannerClearButtonRight) <= 1, "Selected Planner Clear must be right-aligned outside its club card at first paint.");
        const expectedClubHeight = innerWidth <= 520 ? 136 : innerWidth <= 900 ? 156 : 184;
        const expectedClubNameSize = innerWidth <= 520 ? "24px" : innerWidth <= 900 ? "30px" : "34px";
        const expectedClubLogoWidth = innerWidth <= 520 ? "88px" : innerWidth <= 900 ? "110px" : "132px";
        const expectedClubLogoHeight = innerWidth <= 520 ? "96px" : innerWidth <= 900 ? "120px" : "144px";
        assert(parserSnapshot.plannerTeamCardHeight >= expectedClubHeight - 1 && parserSnapshot.plannerTeamCardHeight <= expectedClubHeight + 24, "Planner card must have the Club-page height at first paint.");
        assert(parserSnapshot.plannerTeamNameFontSize === expectedClubNameSize, "Planner club name must have the Club-page font size at first paint.");
        assert(parserSnapshot.plannerTeamLogoMaxWidth === expectedClubLogoWidth && parserSnapshot.plannerTeamLogoMaxHeight === expectedClubLogoHeight, "Planner club logo must have the Club-page size at first paint.");
        if (innerWidth > 600) {
          assert(parserSnapshot.plannerClearButtonLeft - parserSnapshot.plannerTeamCardRight >= 8, "Selected Planner Clear must sit outside the club card on desktop at first paint.");
        } else {
          assert(parserSnapshot.plannerClearButtonTop >= parserSnapshot.plannerTeamCardBottom - 1, "Selected Planner Clear must sit below the club card on phone at first paint.");
        }
      } else {
        assert(parserSnapshot.plannerTeamSelectorHidden === false, "Empty Planner first paint hid the Team search.");
        assert(parserSnapshot.plannerSelectedTeamHidden === true, "Empty Planner first paint exposed a selected club.");
        assert(parserSnapshot.plannerWorkspaceHidden === true, "Empty Planner first paint exposed the workspace.");
      }
    }
  }

  function assertInitialTiming(timeline) {
    const entries = timeline.snapshot();
    const phases = entries.map((entry) => entry.phase);
    const commitIndex = phases.indexOf("content-commit");
    const settledIndex = phases.indexOf("route-visually-settled", commitIndex + 1);
    assert(commitIndex >= 0, scenario + " initial content-commit timing is missing.");
    assert(settledIndex > commitIndex, scenario + " initial visual-settlement timing must follow content commit.");
  }

  function assertSpaTimingAfter(timeline, baselineSequence) {
    const recentEntries = timeline.snapshot().filter((entry) => entry.sequence > baselineSequence);
    const phases = recentEntries.map((entry) => entry.phase);
    const startIndex = phases.lastIndexOf("route-transition-start");
    const commitIndex = phases.indexOf("content-commit", startIndex + 1);
    const completeIndex = phases.indexOf("route-transition-complete", commitIndex + 1);
    const settledIndex = phases.indexOf("route-visually-settled", completeIndex + 1);
    assert(startIndex >= 0, scenario + " SPA route-transition-start timing is missing.");
    assert(commitIndex > startIndex, scenario + " SPA content-commit timing is missing after transition start.");
    assert(completeIndex > commitIndex, scenario + " SPA completion timing must follow content commit.");
    assert(settledIndex > completeIndex, scenario + " SPA visual settlement must follow route completion.");
    assert(
      recentEntries[commitIndex]?.detail?.source === "navigation-release",
      scenario + " SPA content commit has the wrong canonical source.",
    );
  }

  function routeState() {
    if (scenario === "database" || scenario === "database-empty" || scenario === "database-linked-state") {
      return {
        path: window.location.pathname,
        search: window.location.search,
        title: document.title,
        tableText: text("#tableBody"),
        emptyText: text("#emptyState"),
        emptyHidden: hidden("#emptyState"),
        page: String(document.body.dataset.page || ""),
      };
    }
    if (scenario === "player") {
      const activeViews = Array.from(document.querySelectorAll("#playerDetail .playerAttributeViewButton.active"))
        .map((button) => String(button.dataset.playerAttributeView || button.dataset.view || ""));
      return {
        path: window.location.pathname,
        title: document.title,
        hasPlayerName: text("#playerDetail").includes(expectedPlayerName),
        pageHidden: hidden("#playerPage"),
        selectedPlayerView: typeof state !== "undefined" ? String(state.playerAttributeView || "") : "",
        activePlayerViews: activeViews,
        pressedPlayerViews: Array.from(document.querySelectorAll('#playerDetail .playerAttributeViewButton[aria-pressed="true"]'))
          .map((button) => String(button.dataset.playerAttributeView || button.dataset.view || "")),
      };
    }
    if (scenario === "watchlist" || scenario === "watchlist-empty") {
      return {
        path: window.location.pathname,
        search: window.location.search,
        title: document.title,
        tableText: text("#tableBody"),
        emptyText: text("#emptyState"),
        emptyHidden: hidden("#emptyState"),
        watchlistName: text("#watchlistButtonText"),
        lockedHidden: hidden("#myPlayersLockedPage"),
      };
    }
    if (scenario === "myclubs-out" || scenario === "myclubs-in" || scenario === "myclubs-competition-fail" || scenario === "myclubs-stale") {
      return {
        path: window.location.pathname,
        title: document.title,
        page: String(document.body.dataset.page || ""),
        homeHidden: hidden("#homePage"),
        lockedHidden: hidden("#myPlayersLockedPage"),
        myClubsHidden: hidden("#myClubsPage"),
        clubCards: document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length,
        clubText: text("#myClubsGrid"),
        statusText: text("#myClubsStatus"),
        walletAddress: typeof state !== "undefined" ? String(state.linkedWalletAddress || "") : "",
      };
    }
    if (scenario === "planner-out") {
      return {path: window.location.pathname, page: String(document.body.dataset.page || ""), lockedHidden: hidden("#myPlayersLockedPage"), plannerHidden: hidden("#plannerPage"), clubId: text("#plannerTeamId")};
    }
    if (scenario === "planner" || scenario === "planner-selected") {
      return {
        path: window.location.pathname,
        search: window.location.search,
        title: document.title,
        page: String(document.body.dataset.page || ""),
        plannerHidden: hidden("#plannerPage"),
        plannerTitle: text("#plannerPage .tablePageTitle"),
        teamSelectorHidden: hidden("#plannerTeamSelector"),
        selectedTeamHidden: hidden("#plannerSelectedTeam"),
        workspaceHidden: hidden("#plannerWorkspace"),
        teamName: text("#plannerTeamName"),
      };
    }
    return {
      path: window.location.pathname,
      title: document.title,
      total: text("#mflStatsTotalPlayers"),
      packable: text("#mflStatsPackablePlayers"),
      statsHidden: hidden("#mflStatsPage"),
      distributionSkeleton: Boolean(document.querySelector("#mflStatsAgeDistribution .mflStatsHistogramSkeleton")),
      distributionColumns: document.querySelectorAll("#mflStatsAgeDistribution .mflStatsHistogramFill:not(.mflStatsHistogramSkeletonFill)").length,
    };
  }

  function assertRouteState(stateValue) {
    assert(document.documentElement.dataset.mflRouteReady === "true", scenario + " route-ready flag is not settled.");
    assert(!document.body.classList.contains("loading"), scenario + " left the global loading class active.");
    if (scenario === "database") {
      assert(stateValue.path === "/database/attributes", "Database canonical path is wrong: " + stateValue.path);
      assert(stateValue.tableText.includes(expectedPlayerName), "Database did not render the fixture player.");
      assert(stateValue.page === "database", "Database body page owner is wrong: " + stateValue.page);
    } else if (scenario === "database-empty") {
      assert(stateValue.path === "/database/attributes", "Filtered Database canonical path is wrong: " + stateValue.path);
      assert(stateValue.search === "?overall.gte=99", "Filtered Database URL state was not preserved: " + stateValue.search);
      assert(stateValue.tableText === "", "Filtered Database unexpectedly rendered player rows.");
      assert(stateValue.emptyHidden === false, "Filtered Database empty-state message remained hidden after refresh.");
      assert(stateValue.emptyText === "No players match the current filters.", "Filtered Database empty-state message is wrong: " + stateValue.emptyText);
      assert(stateValue.page === "database", "Filtered Database body page owner is wrong: " + stateValue.page);
    } else if (scenario === "database-linked-state") {
      assert(stateValue.path === "/database/attributes", "Linked Database canonical path is wrong: " + stateValue.path);
      assert(
        stateValue.search === "?sort=age&direction=asc&overall.gte=79",
        "Linked Database canonical URL state was not preserved: " + stateValue.search,
      );
      assert(
        stateValue.tableText.includes(expectedPlayerName),
        "Linked Database did not render the fixture player. Debug: " + JSON.stringify({
          rows: typeof state !== "undefined" ? state.rows : null,
          filteredRows: typeof state !== "undefined" ? state.filteredRows : null,
          columns: typeof state !== "undefined" ? state.columns : null,
          pageSize: typeof state !== "undefined" ? state.pageSize : null,
          incrementalMode: typeof state !== "undefined" ? state.incrementalMode : null,
          incrementalTotalRows: typeof state !== "undefined" ? state.incrementalTotalRows : null,
          currentPage: typeof state !== "undefined" ? state.currentPage : null,
          view: typeof state !== "undefined" ? state.view : null,
          sortKey: typeof state !== "undefined" ? state.sortKey : null,
          sortDirection: typeof state !== "undefined" ? state.sortDirection : null,
          hideRetired: document.getElementById("hideRetiredInput")?.checked,
          hideRetiring: document.getElementById("hideRetiringInput")?.checked,
          hideMfl: document.getElementById("hideMflPlayersInput")?.checked,
          newMints: document.getElementById("newMintsInput")?.checked,
          rules: typeof readFilterRules === "function" ? readFilterRules() : null,
          pendingRestore: typeof state !== "undefined" ? state.pendingTableControlRestore : null,
        }),
      );
      assert(stateValue.page === "database", "Linked Database body page owner is wrong: " + stateValue.page);
    } else if (scenario === "player") {
      assert(stateValue.path === "/players/1", "Player canonical path is wrong: " + stateValue.path);
      assert(stateValue.hasPlayerName, "Player detail did not render the fixture identity.");
      assert(stateValue.title === expectedPlayerName + " - MFL Front Office", "Player title is not the full player name.");
      assert(stateValue.pageHidden === false, "Player page remained hidden after readiness.");
      assert(
        stateValue.activePlayerViews.length === 1,
        "Player must expose exactly one active view after loading completes. Debug: " + JSON.stringify({
          selectedPlayerView: stateValue.selectedPlayerView,
          activePlayerViews: stateValue.activePlayerViews,
          rootClasses: document.documentElement.className,
          loadingSnapshot: window.__mflInteractionBusy?.snapshot?.() || null,
          navigationPending: window.__mflNavigation?.isPending?.() || false,
          buttons: Array.from(document.querySelectorAll("#playerDetail .playerAttributeViewButton")).map((button) => ({
            className: button.className,
            dataView: button.dataset.view || "",
            dataPlayerAttributeView: button.dataset.playerAttributeView || "",
            disabled: button.disabled === true,
          })),
        }),
      );
      assert(
        stateValue.activePlayerViews[0] === stateValue.selectedPlayerView,
        "Player active view does not match the selected Player view after loading completes.",
      );
      assert(
        stateValue.pressedPlayerViews.length === 1 && stateValue.pressedPlayerViews[0] === stateValue.selectedPlayerView,
        "Player aria-pressed state does not match the selected Player view after loading completes.",
      );
    } else if (scenario === "watchlist") {
      assert(
        stateValue.path === "/watchlist/" + testWatchlistId + "/current-season",
        "Watchlist canonical path is wrong: " + stateValue.path,
      );
      assert(stateValue.tableText.includes(expectedPlayerName), "Watchlist did not render the stored fixture player.");
      assert(stateValue.watchlistName === "Browser List", "Watchlist selector did not retain the selected list name.");
      assert(stateValue.lockedHidden === true, "Watchlist incorrectly rendered the guest lock screen.");
    } else if (scenario === "watchlist-empty") {
      assert(
        stateValue.path === "/watchlist/" + testWatchlistId + "/current-season",
        "Filtered Watchlist canonical path is wrong: " + stateValue.path,
      );
      assert(stateValue.search === "?overall.gte=99", "Filtered Watchlist URL state was not preserved: " + stateValue.search);
      assert(stateValue.tableText === "", "Filtered Watchlist unexpectedly rendered player rows.");
      assert(stateValue.emptyHidden === false, "Filtered Watchlist empty-state message remained hidden after refresh.");
      assert(
        stateValue.emptyText === "No watchlist players match the current filters.",
        "Filtered Watchlist must distinguish zero matches from an empty watchlist: " + stateValue.emptyText,
      );
      assert(stateValue.watchlistName === "Browser List", "Filtered Watchlist selector did not retain the selected list name.");
      assert(stateValue.lockedHidden === true, "Filtered Watchlist incorrectly rendered the guest lock screen.");
    } else if (scenario === "myclubs-stale") {
      assert(stateValue.path === "/my-clubs/opted-out", "Stale My Clubs proof did not canonicalize to opted-out.");
      assert(stateValue.page === "my-clubs", "Stale My Clubs proof lost the My Clubs page owner.");
      assert(stateValue.homeHidden === true, "Stale My Clubs proof exposed Home.");
      assert(stateValue.lockedHidden === false, "Stale My Clubs proof did not reveal the opt-in shell.");
      assert(stateValue.myClubsHidden === true, "Stale My Clubs proof left the private My Clubs page visible.");
      assert(stateValue.clubCards === 0, "Stale My Clubs proof rendered private club data.");
      assert(stateValue.walletAddress === "", "Stale My Clubs proof did not clear the invalid wallet session.");
    } else if (scenario === "myclubs-out" || scenario === "myclubs-in" || scenario === "myclubs-competition-fail") {
      const optedIn = scenario !== "myclubs-out";
      assert(
        stateValue.path === (optedIn ? "/my-clubs" : "/my-clubs/opted-out"),
        "My Clubs canonical path is wrong: " + stateValue.path,
      );
      assert(stateValue.page === "my-clubs", "My Clubs body page owner is wrong: " + stateValue.page);
      assert(stateValue.homeHidden === true, "My Clubs exposed Home after route readiness.");
      assert(stateValue.lockedHidden === optedIn, "My Clubs locked-shell visibility is wrong.");
      assert(stateValue.myClubsHidden === !optedIn, "My Clubs page visibility is wrong.");
      if (optedIn) {
        assert(stateValue.clubCards === 3, "My Clubs did not render the exact fetched club-card count.");
        assert(
          stateValue.clubText.includes("Browser Club")
            && stateValue.clubText.includes("Second Browser Club")
            && stateValue.clubText.includes("Unavailable Competition Club"),
          "My Clubs did not render all fixture clubs.",
        );
        if (scenario === "myclubs-in") {
          assert(stateValue.clubText.includes("Browser League") && stateValue.clubText.includes("2nd"), "My Clubs did not render the current league standing.");
          assert(stateValue.clubText.includes("Browser Cup") && stateValue.clubText.includes("Semi-final"), "My Clubs did not render the current cup stage.");
          assert(
            document.querySelectorAll("#myClubsGrid .myClubCompetitionName[title]").length === 0,
            "My Clubs competition names must not expose Season x hover tooltips.",
          );
        } else {
          assert(!stateValue.clubText.includes("Browser League") && !stateValue.clubText.includes("Browser Cup"), "My Clubs competition failure rendered stale competition content.");
        }
        assert(!stateValue.clubText.includes("Competition data unavailable"), "My Clubs exposed a competition failure label instead of keeping the remaining card content aligned.");
        assert(stateValue.statusText === "", "My Clubs reported an unexpected load status: " + stateValue.statusText);
      } else {
        assert(stateValue.clubCards === 0, "Opted-out My Clubs rendered private club data.");
      }
    } else if (scenario === "mflstats") {
      assert(stateValue.path === "/mfl/stats", "MFL Stats canonical path is wrong: " + stateValue.path);
      assert(stateValue.total === "1", "MFL Stats total count did not render the fixture player.");
      assert(stateValue.packable === "1", "MFL Stats packable count did not classify the fixture player.");
      assert(stateValue.statsHidden === false, "MFL Stats page remained hidden after readiness.");
      assert(stateValue.distributionSkeleton === false, "MFL Stats kept its skeleton after authoritative data rendered.");
      assert(stateValue.distributionColumns > 0, "MFL Stats did not restore real histogram columns after navigation.");
    } else if (scenario === "planner-out") {
      assert(stateValue.path === "/planner/opted-out", "Opted-out Planner must use its canonical locked route.");
      assert(stateValue.page === "planner" && !stateValue.lockedHidden && stateValue.plannerHidden && !stateValue.clubId, "Opted-out Planner must not reveal its club identity or workspace.");
      assert(myClubsRequests.ownership === 0, "Opted-out Planner must never request private clubs.");
    } else if (scenario === "planner" || scenario === "planner-selected") {
      assert(stateValue.path === "/planner", "Planner canonical path is wrong: " + stateValue.path);
      assert(stateValue.page === "planner", "Planner body page owner is wrong: " + stateValue.page);
      assert(stateValue.plannerHidden === false, "Planner page became hidden after route readiness.");
      assert(stateValue.plannerTitle === "Planner", "Planner heading changed after route readiness: " + stateValue.plannerTitle);
      assert(stateValue.title === "Planner - MFL Front Office", "Planner browser title changed after route readiness: " + stateValue.title);
      if (scenario === "planner-selected") {
        assert(stateValue.search === "?club=9001", "Selected Planner query state was not preserved: " + stateValue.search);
        assert(stateValue.teamSelectorHidden === true, "Selected Planner exposed the Team search after readiness.");
        assert(stateValue.selectedTeamHidden === false && stateValue.workspaceHidden === false, "Selected Planner did not keep the club workspace visible.");
        assert(stateValue.teamName === "Browser Club", "Selected Planner did not restore the club identity.");
      }
    }
  }

  function assertPageAccessibilityState() {
    const pages = Array.from(document.querySelectorAll("#appShell main > .pageView"))
      .filter((page) => page instanceof HTMLElement);
    const visiblePages = pages.filter((page) => !page.hidden);
    assert(visiblePages.length === 1, "Exactly one top-level page must remain visible/accessibility-active: " + JSON.stringify(
      visiblePages.map((page) => page.id),
    ));
    pages.forEach((page) => {
      if (page.hidden) {
        assert(page.inert === true, page.id + " hidden route is not inert.");
        assert(page.getAttribute("aria-hidden") === "true", page.id + " hidden route is not aria-hidden.");
      } else {
        assert(page.inert === false, page.id + " active route remained inert.");
        assert(!page.hasAttribute("aria-hidden"), page.id + " active route remained aria-hidden.");
      }
    });
  }

  async function assertDatabaseSortAccessibility() {
    if (scenario !== "database") return;
    const nameHeader = document.querySelector('#tableHead th[data-table-column="name"]');
    const nameButton = nameHeader?.querySelector(":scope > .tableSortButton");
    assert(nameHeader instanceof HTMLTableCellElement, "Database Name header is missing.");
    assert(nameButton instanceof HTMLButtonElement, "Sortable Name header must expose a native button.");
    assert(nameButton.getAttribute("aria-label") === "Sort by Name", "Sortable Name button has the wrong accessible name.");
    const loadedHeaderColor = getComputedStyle(nameButton).color;
    nameButton.disabled = true;
    assert(getComputedStyle(nameButton).opacity === "1", "Loading sort headers must retain full opacity despite generic disabled-button styling.");
    assert(getComputedStyle(nameButton).color === loadedHeaderColor, "Loading sort headers must retain their loaded text color.");
    nameButton.disabled = false;
    nameButton.focus();
    assert(document.activeElement === nameButton, "Sortable Name button is not keyboard focusable.");
    nameButton.click();
    await waitFor(
      () => document.querySelector('#tableHead th[data-table-column="name"]')?.getAttribute("aria-sort") === "ascending",
      "Database Name sort did not expose aria-sort=ascending.",
    );
    const overallButton = document.querySelector('#tableHead th[data-table-column="overall"] > .tableSortButton');
    assert(overallButton instanceof HTMLButtonElement, "Overall sort button is missing after Name sorting.");
    overallButton.click();
    await waitFor(
      () => document.querySelector('#tableHead th[data-table-column="overall"]')?.getAttribute("aria-sort") === "descending",
      "Database sort did not restore Overall descending semantics.",
    );
  }

  function assertParkedTableSpacing() {
    if (scenario !== "database") return;
    // Exercise the real stylesheet with a parked Table before and after the active
    // route: neither route order may move the title or duplicate footer spacing.
    const main = document.createElement("main");
    const parked = document.createElement("section");
    parked.id = "progressionPage";
    parked.className = "pageView mflCachedTablePageParked";
    const active = document.createElement("section");
    active.className = "pageView";
    const footer = document.createElement("footer");
    footer.className = "siteFooterDetails";
    main.append(active, footer);
    document.getElementById("appShell").appendChild(main);
    try {
      const top = active.getBoundingClientRect().top;
      const gap = footer.getBoundingClientRect().top - active.getBoundingClientRect().bottom;
      const expectedGap = parseFloat(getComputedStyle(footer).marginTop);
      assert(expectedGap > 0 && Math.abs(gap - expectedGap) < 1, "The footer must retain its responsive content gap.");
      main.prepend(parked);
      assert(Math.abs(active.getBoundingClientRect().top - top) < 1, "A parked Table must not increase header-to-title spacing.");
      footer.before(parked);
      assert(Math.abs(footer.getBoundingClientRect().top - active.getBoundingClientRect().bottom - gap) < 1,
        "A parked Table must not add another footer gap.");
    } finally {
      main.remove();
    }
  }

  async function assertStickyNameSeparator() {
    if (scenario !== "database" || !matchMedia("(max-width: 900px)").matches) return;
    const scroller = document.querySelector("#progressionPage .playerTableScroller");
    const name = document.querySelector("#tableBody .playerNameCell");
    const cell = name?.closest("td");
    const preceding = document.querySelector("#tableHead th.col-name")?.previousElementSibling;
    assert(scroller instanceof HTMLElement && name instanceof HTMLElement && cell instanceof HTMLElement
      && preceding instanceof HTMLElement, "Mobile sticky Name fixture is missing.");
    assert(getComputedStyle(cell).containerType === "normal", "Name rows must not create scroll-state query containers.");
    const edge = scroller.getBoundingClientRect().left + scroller.clientLeft;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const threshold = preceding.getBoundingClientRect().right - edge + scroller.scrollLeft;
    const checkScroll = async (left, expected) => {
      scroller.scrollLeft = Math.min(maxScroll, Math.max(0, left));
      scroller.dispatchEvent(new Event("scroll"));
      await delay(80);
      const stuck = scroller.classList.contains("mflPlayerTableNameStuck");
      assert(stuck === expected, "Name stuck state is wrong at scrollLeft=" + scroller.scrollLeft);
      if (expected) {
        const separator = getComputedStyle(name, "::before");
        assert(separator.content === '\"\"' && parseFloat(separator.borderRightWidth) > 0,
          "Name separator must be painted while the Name column is stuck.");
        assert(Math.abs(cell.getBoundingClientRect().left - edge) < 1, "Name must stay pinned at the scroller edge.");
      }
    };
    await checkScroll(0, false);
    if (maxScroll <= 2) return;
    await checkScroll(Math.max(0, threshold - 2), false);
    if (maxScroll <= threshold) {
      await checkScroll(maxScroll, false);
      await checkScroll(0, false);
      return;
    }
    await checkScroll(Math.min(maxScroll, threshold + 4), true);
    await checkScroll(maxScroll, true);
    await checkScroll(0, false);
  }

  async function assertSharedModalFocusLifecycle() {
    if (scenario !== "database") return;
    const trigger = document.getElementById("openSearchButton");
    const modal = document.getElementById("searchModal");
    const closeButton = document.getElementById("closeSearchButton");
    const shell = document.getElementById("appShell");
    assert(trigger instanceof HTMLButtonElement && modal instanceof HTMLElement && closeButton instanceof HTMLButtonElement,
      "Shared Search modal controls are unavailable.");
    trigger.focus();
    trigger.click();
    await waitFor(() => modal.hidden === false && modal.contains(document.activeElement), "Search modal did not receive focus after opening.");
    assert(shell instanceof HTMLElement && shell.inert === true, "Application shell did not become inert while Search was open.");
    assert(shell.getAttribute("aria-hidden") === "true", "Application shell did not leave the accessibility tree while Search was open.");

    const focusable = Array.from(modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element instanceof HTMLElement && !element.hidden && element.getClientRects().length > 0);
    assert(focusable.length > 1, "Search modal does not expose enough focusable controls to test focus containment.");
    const first = focusable[0];
    const last = focusable.at(-1);
    last.focus();
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    assert(document.activeElement === first, "Tab did not wrap from the final Search control to the first control.");
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    assert(document.activeElement === last, "Shift+Tab did not wrap from the first Search control to the final control.");

    closeButton.click();
    await waitFor(() => modal.hidden === true, "Search modal did not close.");
    assert(shell.inert === false && !shell.hasAttribute("aria-hidden"), "Application shell remained inaccessible after Search closed.");
    assert(document.activeElement === trigger, "Search modal did not restore focus to its opening control.");
  }

  function assertLoadingAccessibility() {
    if (scenario !== "database") return;
    const controller = window.__mflInteractionBusy;
    const main = document.querySelector("#appShell > main");
    assert(controller && typeof controller.begin === "function" && typeof controller.end === "function", "Shared loading controller is unavailable.");
    assert(main instanceof HTMLElement, "Canonical main region is unavailable.");
    const token = controller.begin("table-filter-loading");
    assert(main.getAttribute("aria-busy") === "true", "Main region did not expose aria-busy during data loading.");
    assert(text("#mflLoadingAnnouncement") === "Loading content.", "Loading status did not announce loading.");
    controller.end(token);
    assert(main.getAttribute("aria-busy") === "false", "Main region remained aria-busy after data loading.");
    assert(text("#mflLoadingAnnouncement") === "Content loaded.", "Loading status did not announce completion.");
  }

  async function navigateBackToScenario(setPage, timeline) {
    if (scenario === "player") {
      const originalEnsureRouteCore = window.__mflEnsureRouteCore;
      let evaluationCoreRequested = false;
      let releaseEvaluationCore = null;
      window.__mflEnsureRouteCore = (pageName, options = {}) => {
        if (String(pageName || "") !== "evaluation" || typeof originalEnsureRouteCore !== "function") {
          return originalEnsureRouteCore?.(pageName, options);
        }
        if (evaluationCoreRequested) return originalEnsureRouteCore(pageName, options);
        evaluationCoreRequested = true;
        return new Promise((resolve, reject) => {
          releaseEvaluationCore = () => Promise.resolve(originalEnsureRouteCore(pageName, options)).then(resolve, reject);
        });
      };

      const evaluationNavigation = setPage("evaluation", true, { plain: true });
      await waitFor(() => evaluationCoreRequested && typeof releaseEvaluationCore === "function",
        "Evaluation navigation did not request its lazy interaction core.");
      await delay(80);

      const playerPageBeforeCommit = document.getElementById("playerPage");
      const evaluationPageBeforeCommit = document.getElementById("evaluationPage");
      assert(window.location.pathname !== "/evaluation",
        "Evaluation URL committed before its interaction core was ready.");
      assert(playerPageBeforeCommit instanceof HTMLElement && !playerPageBeforeCommit.hidden && !playerPageBeforeCommit.inert,
        "Player stopped being interactive before Evaluation controls were ready.");
      assert(evaluationPageBeforeCommit instanceof HTMLElement && evaluationPageBeforeCommit.hidden,
        "Evaluation became visible before its interaction handlers were ready.");

      releaseEvaluationCore();
      await evaluationNavigation;
      window.__mflEnsureRouteCore = originalEnsureRouteCore;

      await waitFor(() => window.location.pathname === "/evaluation" && document.getElementById("evaluationPage")?.hidden === false,
        "Player could not navigate to Evaluation for accessibility cleanup.");
      const playerPage = document.getElementById("playerPage");
      const evaluationPage = document.getElementById("evaluationPage");
      const appShell = document.getElementById("appShell");
      assert(playerPage instanceof HTMLElement && playerPage.hidden && playerPage.inert,
        "Player route remained accessibility-active after navigating to Evaluation.");
      assert(playerPage.getAttribute("aria-hidden") === "true",
        "Player route remained in the accessibility tree after navigating to Evaluation.");
      assert(evaluationPage instanceof HTMLElement && !evaluationPage.inert,
        "Visible Evaluation route remained inert after its interaction core became ready.");
      assert(appShell instanceof HTMLElement && !appShell.inert,
        "Application shell remained inert after Evaluation navigation completed.");

      const advancedSettingsButton = document.querySelector("#evaluationPage .advancedSettingsButton");
      const advancedSettingsModal = document.getElementById("advancedSettingsModal");
      const closeAdvancedSettingsButton = document.getElementById("closeAdvancedSettingsButton");
      assert(advancedSettingsButton instanceof HTMLButtonElement
        && advancedSettingsModal instanceof HTMLElement
        && closeAdvancedSettingsButton instanceof HTMLButtonElement,
      "Evaluation interaction regression could not find the Advanced Settings controls.");
      const evaluationMain = document.querySelector("#appShell > main");
      assert(evaluationMain instanceof HTMLElement,
        "Evaluation interaction regression could not find the main scrollport.");
      const scrollbarSpacer = document.createElement("div");
      scrollbarSpacer.dataset.mflEvaluationScrollbarRegression = "true";
      scrollbarSpacer.style.height = String(Math.max(evaluationMain.clientHeight + 64, 720)) + "px";
      scrollbarSpacer.style.pointerEvents = "none";
      evaluationPage.appendChild(scrollbarSpacer);
      await delay(25);
      assert(evaluationMain.scrollHeight > evaluationMain.clientHeight,
        "Evaluation interaction regression did not create the reported vertical-scrollbar state.");

      const advancedSettingsRect = advancedSettingsButton.getBoundingClientRect();
      const advancedSettingsHitTarget = document.elementFromPoint(
        advancedSettingsRect.left + advancedSettingsRect.width / 2,
        advancedSettingsRect.top + advancedSettingsRect.height / 2,
      );
      assert(
        advancedSettingsHitTarget instanceof Element
          && (advancedSettingsHitTarget === advancedSettingsButton || advancedSettingsButton.contains(advancedSettingsHitTarget)),
        "Evaluation Advanced Settings is visually exposed but blocked from pointer hit-testing. Debug: " + JSON.stringify({
          viewport: { width: innerWidth, height: innerHeight },
          button: {
            left: advancedSettingsRect.left,
            top: advancedSettingsRect.top,
            right: advancedSettingsRect.right,
            bottom: advancedSettingsRect.bottom,
          },
          hitTarget: advancedSettingsHitTarget instanceof Element
            ? {
                tag: advancedSettingsHitTarget.tagName,
                id: advancedSettingsHitTarget.id,
                className: String(advancedSettingsHitTarget.className || ""),
              }
            : null,
          main: (() => {
            const main = document.querySelector("#appShell > main");
            return main instanceof HTMLElement
              ? { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, scrollTop: main.scrollTop }
              : null;
          })(),
          searchResults: (() => {
            const results = document.getElementById("evaluationSearchResults");
            if (!(results instanceof HTMLElement)) return null;
            const rect = results.getBoundingClientRect();
            return {
              hidden: results.hidden,
              children: results.children.length,
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            };
          })(),
        }),
      );
      advancedSettingsButton.click();
      await waitFor(() => advancedSettingsModal.hidden === false && advancedSettingsModal.classList.contains("modalOpen"),
        "Evaluation Advanced Settings button was visible but not interactive on first entry.");
      closeAdvancedSettingsButton.click();
      await waitFor(() => advancedSettingsModal.hidden === true,
        "Evaluation Advanced Settings modal did not close after the interaction-readiness check.");

      await setPage("evaluation", true, { playerId: "1" });
      await waitFor(
        () => window.location.pathname === "/evaluation"
          && new URL(window.location.href).searchParams.get("player") === "1"
          && document.querySelector("#evaluationTableBody [data-evaluation-overall-delta=\"1\"]") instanceof HTMLButtonElement,
        "Evaluation player controls did not become ready for displaced-row interaction coverage.",
      );

      const overallIncreaseButton = document.querySelector("#evaluationTableBody [data-evaluation-overall-delta=\"1\"]");
      const evaluationResetControl = document.getElementById("evaluationResetButton");
      const evaluationPlayerPageControl = document.getElementById("evaluationPlayerPageButton");
      assert(
        overallIncreaseButton instanceof HTMLButtonElement
          && evaluationResetControl instanceof HTMLButtonElement
          && evaluationPlayerPageControl instanceof HTMLButtonElement,
        "Evaluation displaced-row regression could not find +, Reset, and Player Page controls.",
      );

      const overallValue = () => Number(
        overallIncreaseButton.closest(".evaluationOverallControl")?.querySelector("strong")?.textContent || 0
      );
      const initialOverall = overallValue();
      assert(initialOverall > 0, "Evaluation displaced-row regression could not read the current Overall.");

      state.rows = [];
      state.filteredRows = [];
      overallIncreaseButton.click();
      await waitFor(
        () => Number(document.querySelector("#evaluationTableBody .evaluationOverallControl strong")?.textContent || 0) === initialOverall + 1,
        "Evaluation + control stopped working after shared route rows were displaced.",
      );

      state.rows = [];
      state.filteredRows = [];
      evaluationResetControl.click();
      await waitFor(
        () => Number(document.querySelector("#evaluationTableBody .evaluationOverallControl strong")?.textContent || 0) === initialOverall,
        "Evaluation Reset stopped working after shared route rows were displaced.",
      );

      state.rows = [];
      state.filteredRows = [];
      const originalWindowOpen = window.open;
      let openedPlayerUrl = "";
      window.open = (url) => {
        openedPlayerUrl = String(url || "");
        return { blur() {} };
      };
      try {
        evaluationPlayerPageControl.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }));
      } finally {
        window.open = originalWindowOpen;
      }
      assert(
        openedPlayerUrl.includes("/players/1"),
        "Evaluation Player Page stopped working after shared route rows were displaced.",
      );

      scrollbarSpacer.remove();
      assertPageAccessibilityState();
    }
    await setPage("privacy", true);
    await waitFor(() => window.location.pathname === "/privacy", scenario + " could not navigate to Privacy.");
    const baselineSequence = timeline.snapshot().at(-1)?.sequence || 0;

    if (scenario === "database" || scenario === "database-empty") {
      await setPage("database", true, { view: "attributes" });
    } else if (scenario === "player") {
      await setPage("player", true, { playerId: "1" });
    } else if (scenario === "watchlist" || scenario === "watchlist-empty") {
      await setPage("watchlist", true, { watchlistId: testWatchlistId, view: "current" });
    } else if (scenario === "mflstats") {
      const requestsBefore = mflStatsSummaryRequests;
      await setPage("mfl", true, { view: "stats" });
      assert(
        mflStatsSummaryRequests === requestsBefore,
        "MFL Stats cached re-entry repeated the compact summary request.",
      );
    } else if (scenario === "myclubs-in") {
      const requestsBefore = { ...myClubsRequests };
      await setPage("home", true);
      await setPage("my-clubs", true);
      assert(document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length === 3,
        "My Clubs return navigation did not reuse completed cards.");
      assert(myClubsRequests.ownership === requestsBefore.ownership
        && myClubsRequests.competitions === requestsBefore.competitions,
        "My Clubs return navigation repeated fresh data requests.");
      await setPage("home", true);
      window.__mflMyClubsRoute.clear();
      const returnNavigation = setPage("my-clubs", true);
      await delay(30);
      assert(document.querySelectorAll("#myClubsGrid .myClubCard").length === 0, "My Clubs showed guessed boxes before the ownership response.");
      assert(document.getElementById("myClubsPage")?.hidden === false, "My Clubs shell was hidden while ownership data was pending.");
      await waitFor(
        () => document.querySelectorAll("#myClubsGrid .myClubCardLoading").length === 3,
        "My Clubs did not render the exact fetched number of full-card skeletons after ownership resolved.",
      );
      assert(
        document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length === 0,
        "My Clubs exposed real club cards before their competition requests settled.",
      );
      const loadingSkeleton = document.querySelector('#myClubsGrid .myClubCardLoading[data-club-id="9003"]');
      loadingSkeletonHeight = loadingSkeleton instanceof HTMLElement
        ? loadingSkeleton.getBoundingClientRect().height
        : 0;
      assert(loadingSkeletonHeight > 0, "My Clubs could not measure skeleton geometry.");
      const pendingRequests = { ...myClubsRequests };
      await setPage("home", true);
      await setPage("my-clubs", true);
      assert(myClubsRequests.ownership === pendingRequests.ownership
        && myClubsRequests.competitions === pendingRequests.competitions,
        "My Clubs repeated a pending ownership or competition request.");
      await returnNavigation;
      await waitFor(
        () => document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length === 3,
        "My Clubs did not commit all real club cards together after the competition batch.",
      );
      assert(
        document.querySelectorAll("#myClubsGrid .myClubCardLoading").length === 0,
        "My Clubs left skeleton cards behind after the competition batch settled.",
      );
      assert(
        text("#myClubsGrid").includes("Browser League") && text("#myClubsGrid").includes("Browser Cup"),
        "My Clubs batch competition enrichment did not render its league and cup fixtures.",
      );
      const noCompetitionCard = document.querySelector('#myClubsGrid .myClubCard[data-club-id="9003"]:not(.myClubCardLoading)');
      assert(noCompetitionCard instanceof HTMLElement, "My Clubs did not render the club without competition data.");
      assert(
        Math.abs(noCompetitionCard.getBoundingClientRect().height - loadingSkeletonHeight) <= 1,
        "My Clubs changed card height when competition data was empty.",
      );
      const firstClubCard = document.querySelector('#myClubsGrid .myClubCard[data-club-id="9001"]:not(.myClubCardLoading)');
      assert(firstClubCard instanceof HTMLAnchorElement, "My Clubs Club A card is unavailable for navigation regression.");
      const identityLogo = document.getElementById("clubIdentityLogo");
      const identityLogoFrame = document.querySelector("#clubIdentity .clubIdentityLogoFrame");
      assert(identityLogo instanceof HTMLImageElement && identityLogoFrame instanceof HTMLElement, "Club identity logo shell is unavailable.");
      let destinationLogoPainted = false;
      let destinationLogoDropped = false;
      const trackDestinationLogo = () => {
        const currentSrc = String(identityLogo.getAttribute("src") || "");
        const visible = !identityLogo.hidden && !identityLogoFrame.hidden && currentSrc === expectedBrowserClubLogo;
        if (visible) destinationLogoPainted = true;
        if (destinationLogoPainted && !visible) destinationLogoDropped = true;
      };
      const logoObserver = new MutationObserver(trackDestinationLogo);
      logoObserver.observe(identityLogo, { attributes: true, attributeFilter: ["src", "hidden"] });
      logoObserver.observe(identityLogoFrame, { attributes: true, attributeFilter: ["hidden"] });

      firstClubCard.click();
      trackDestinationLogo();
      assert(text("#clubIdentityLocation") === "Bologna, Italy", "Club first paint did not normalize the already-loaded nation label.");
      assert(!text("#clubIdentityLocation").includes("ITALY"), "Club first paint briefly exposed the raw uppercase nation value.");
      assert(destinationLogoPainted, "Club first paint did not reuse the logo already loaded by My Clubs.");
      await delay(120);
      trackDestinationLogo();
      assert(!destinationLogoDropped, "Club first paint dropped an already-loaded My Clubs logo before profile hydration.");
      await waitFor(() => window.location.pathname === "/clubs/9001/squad", "Club A did not open on the canonical Squad route.");
      await waitFor(() => text("#clubIdentityName") === "Browser Club", "Club A identity did not render before overlap regression.");
      await waitFor(() => text("#clubIdentityOwnerName") === "Browser Owner", "Club A full profile did not settle after first-paint logo regression.");
      trackDestinationLogo();
      logoObserver.disconnect();
      assert(!destinationLogoDropped, "Club logo disappeared between first paint and the hydrated profile.");
      await delay(30);

      const returnToMyClubs = setPage("my-clubs", true);
      await waitFor(
        () => document.getElementById("myClubsPage")?.hidden === false
          && document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length === 3,
        "My Clubs did not become clickable while the previous Club request was still being superseded.",
      );

      const secondClubCard = document.querySelector('#myClubsGrid .myClubCard[data-club-id="9002"]:not(.myClubCardLoading)');
      assert(secondClubCard instanceof HTMLAnchorElement, "My Clubs Club B card is unavailable for navigation regression.");
      secondClubCard.click();
      assert(text("#clubIdentityName") !== "Browser Club", "Club B navigation briefly reused Club A identity.");
      assert(text("#clubIdentityName") === "Second Browser Club", "Club B destination identity was not prepared synchronously.");
      await waitFor(() => window.location.pathname === "/clubs/9002/squad", "Club B click was blocked by the stale Club A request.");
      await waitFor(() => text("#clubIdentityName") === "Second Browser Club", "Club B identity did not remain authoritative.");
      await returnToMyClubs.catch(() => null);

      await setPage("my-clubs", true);
      await waitFor(
        () => document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length === 3,
        "My Clubs did not recover after the Club A -> My Clubs -> Club B overlap regression.",
      );
    } else if (scenario === "myclubs-competition-fail") {
      await setPage("my-clubs", true);
      await waitFor(
        () => document.querySelectorAll("#myClubsGrid .myClubCardCompetitionUnavailable").length === 3,
        "My Clubs did not render all fallback cards together after the competition batch failed.",
      );
      const fallbackCards = Array.from(document.querySelectorAll("#myClubsGrid .myClubCardCompetitionUnavailable"));
      fallbackCards.forEach((card) => {
        assert(card.querySelector(".myClubCompetitions") === null, "My Clubs competition failure left the competition section/separator in the card.");
        const body = card.querySelector(".myClubCardBody");
        assert(body instanceof HTMLElement, "My Clubs competition failure card body is missing.");
        assert(getComputedStyle(body).justifyContent === "center", "My Clubs remaining content is not vertically aligned after competition failure.");
      });
    } else if (scenario === "myclubs-out" || scenario === "myclubs-stale") {
      await setPage("my-clubs", true);
    } else if (scenario === "mflstats") {
      await setPage("mfl", true, { view: "stats" });
    }

    await delay(100);
    assertSpaTimingAfter(timeline, baselineSequence);
  }

  async function runRepresentativeRoute() {
    const setPage = Reflect.get(window, "setPage");
    const timeline = window.__mflClientPerformance;
    assert(typeof setPage === "function", "Canonical setPage owner is unavailable.");
    assert(timeline && typeof timeline.snapshot === "function", "Client performance timeline is unavailable.");
    assert(scenario !== "unknown", "Browser regression scenario could not be derived from the route.");
    assertInitialFirstPaint();
    assertInitialTiming(timeline);

    await waitFor(() => document.documentElement.dataset.mflRouteReady === "true", scenario + " direct refresh never settled.");
    if (scenario === "database-linked-state") {
      await delay(80);
      linkedTablePaintSampling = false;
      assert(
        linkedTablePaintHistory.filterCounts.length >= 1
          && linkedTablePaintHistory.filterCounts.every((count) => count === "1"),
        "Linked Database refresh painted a wrong filter count: " + JSON.stringify(linkedTablePaintHistory.filterCounts),
      );
      assert(
        linkedTablePaintHistory.sortStates.length >= 1
          && linkedTablePaintHistory.sortStates.every((sortState) => sortState === "age:ascending"),
        "Linked Database refresh repainted a wrong sort header: " + JSON.stringify(linkedTablePaintHistory.sortStates),
      );
    }
    const compactDatabaseStickyRegression = scenario === "database"
      && document.documentElement.clientWidth <= 900;
    if (compactDatabaseStickyRegression) {
      const waitForStickyTableStructure = (label) => waitFor(
        () => document.querySelector("#tableHead th.col-name") instanceof HTMLTableCellElement
          && document.querySelector("#tableBody td.nameCell") instanceof HTMLTableCellElement,
        label,
      );
      await waitForStickyTableStructure("Compact Database direct refresh did not expose the sticky Name table structure.");
      assertSharedChromeGeometry();
      assertPageAccessibilityState();
      await assertStickyNameSeparator();
      await navigateBackToScenario(setPage, timeline);
      await waitForStickyTableStructure("Compact Database cached return did not expose the sticky Name table structure.");
      await assertStickyNameSeparator();
      assertSharedChromeGeometry();
      assertPageAccessibilityState();
      assert(errors.length === 0, "Console/runtime errors occurred: " + errors.join(" | "));
      finish("passed", "database: compact sticky Name behavior remained canonical across direct and cached routes.");
      return;
    }
    assertSharedChromeGeometry();
    assertPageAccessibilityState();
    assertLoadingAccessibility();
    assertParkedTableSpacing();
    await assertDatabaseSortAccessibility();
    await assertStickyNameSeparator();
    await assertSharedModalFocusLifecycle();
    if (scenario === "myclubs-in") {
      const ownershipRequest = timeline.snapshot().find((entry) => entry.phase === "data-request"
        && entry.detail?.url === "/api/data?mode=my-clubs");
      const coreReady = timeline.snapshot().find((entry) => entry.phase === "core-ready");
      assert(ownershipRequest && coreReady && ownershipRequest.sequence < coreReady.sequence,
        "My Clubs ownership lookup did not start before application core initialization.");
      assert(myClubsRequests.ownership === 1,
        "My Clubs did not consume the early ownership response exactly once.");
      await waitFor(
        () => document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length === 3
          && text("#myClubsGrid").includes("Browser League")
          && text("#myClubsGrid").includes("Browser Cup"),
        "My Clubs direct batch competition enrichment did not settle.",
      );
    } else if (scenario === "myclubs-competition-fail") {
      await waitFor(
        () => document.querySelectorAll("#myClubsGrid .myClubCardCompetitionUnavailable").length === 3,
        "My Clubs direct competition-failure fallback did not settle.",
      );
      document.querySelectorAll("#myClubsGrid .myClubCardCompetitionUnavailable").forEach((card) => {
        assert(card.querySelector(".myClubCompetitions") === null, "My Clubs direct failure fallback kept its separator.");
      });
    } else if (scenario === "planner-selected") {
      await waitFor(
        () => text("#plannerTeamName") === "Browser Club"
          && document.querySelector("#plannerRosterBody tr[data-player-id]"),
        "Selected Planner direct refresh",
      );
    } else {
      await delay(80);
    }
    const directState = routeState();
    assertRouteState(directState);

    if (scenario === "planner-out") {
      assert(hidden("#plannerPage") && !hidden("#myPlayersLockedPage"), "Opted-out Planner must show only the opt-in shell.");
      finish("passed", "planner-out: first paint and route hydration remain locked without fetching private clubs.");
      return;
    }
    if (scenario === "planner-selected") {
      assert(hidden("#plannerTeamSelector"), "Selected Planner refresh must keep the Team search hidden.");
      assert(!hidden("#plannerSelectedTeam"), "Selected Planner refresh must show the club identity.");
      assert(!hidden("#plannerWorkspace"), "Selected Planner refresh must show the workspace.");
      assert(text("#plannerTeamName") === "Browser Club", "Selected Planner refresh must restore the team name.");
      assert(document.getElementById("plannerFormationSelect")?.value === parserSnapshot.plannerFormation, "Planner formation must not flash back to default during hydration.");
      assert(getComputedStyle(document.getElementById("plannerFormationSelect")).paddingRight === parserSnapshot.plannerFormationPaddingRight, "Formation chevron must not shift during hydration.");
      assert(text("#plannerTeamDivision") === "Gold", "Selected Planner refresh must restore the division.");
      assert(document.getElementById("plannerTeamCard").style.getPropertyValue("--my-club-primary") === parserSnapshot.plannerTeamPrimaryColor, "Planner first-paint Club colours must persist through hydration.");
      assert(document.querySelector("#plannerSelectedTeam .myClubCard.plannerTeamCard"), "Selected Planner refresh must render the canonical My Clubs card.");
      assert(text("#plannerTeamId") === "Club #9001", "Selected Planner card must show its club ID.");
       assert(Math.abs(document.getElementById("plannerTeamId").getBoundingClientRect().top - parserSnapshot.plannerTeamIdTop) <= 2, "Selected Planner Club #ID must not move vertically between first paint and hydrated identity.");
      assert(text("#plannerTeamLocation") === parserSnapshot.plannerTeamLocationText, "Planner first-paint city and nation must persist after hydration.");
      assert(document.querySelector("#plannerTeamLocation .clubLocationFlag")?.getAttribute("src") === parserSnapshot.plannerTeamFlagSrc, "Planner flag must keep the canonical first-paint image through hydration.");
      assert(text("#plannerTeamLocation").includes("Bologna"), "Selected Planner card must hydrate its location.");
      const selectedBox = document.getElementById("plannerSelectedTeam").getBoundingClientRect();
      const clearBox = document.getElementById("plannerTeamClearButton").getBoundingClientRect();
      const cardBox = document.getElementById("plannerTeamCard").getBoundingClientRect();
      assert(Math.abs(selectedBox.right - clearBox.right) <= 1, "Selected Planner Clear must stay right-aligned outside its card after hydration.");
      const expectedClubHeight = innerWidth <= 520 ? 136 : innerWidth <= 900 ? 156 : 184;
      const expectedClubNameSize = innerWidth <= 520 ? "24px" : innerWidth <= 900 ? "30px" : "34px";
      const expectedClubLogoWidth = innerWidth <= 520 ? "88px" : innerWidth <= 900 ? "110px" : "132px";
      const expectedClubLogoHeight = innerWidth <= 520 ? "96px" : innerWidth <= 900 ? "120px" : "144px";
      assert(cardBox.height >= expectedClubHeight - 1 && cardBox.height <= expectedClubHeight + 24, "Planner club card must match the Club-page height after hydration.");
      assert(getComputedStyle(document.getElementById("plannerTeamName")).fontSize === expectedClubNameSize, "Planner name must match Club-page font size after hydration.");
      assert(getComputedStyle(document.getElementById("plannerTeamLogo")).maxWidth === expectedClubLogoWidth && getComputedStyle(document.getElementById("plannerTeamLogo")).maxHeight === expectedClubLogoHeight, "Planner logo must match Club-page size after hydration.");
      if (innerWidth > 600) {
        assert(clearBox.left - cardBox.right >= 8, "Selected Planner Clear must stay outside the club card on desktop.");
      } else {
        assert(clearBox.top >= cardBox.bottom - 1, "Selected Planner Clear must stay below the club card on phone.");
      }
      assert(document.querySelector("#plannerTeamCard .clubIdentityPrimary .clubIdentityName"), "Planner club name must reuse the Club page identity position.");
      assert(document.querySelector("#plannerTeamCard .clubIdentityPrimary .clubIdentityMeta"), "Planner club division/location must reuse the Club page identity position.");
      assert(document.getElementById("plannerTeamLogo").src.includes("/9001/logo.webp"), "Selected Planner refresh must show the club logo.");
      assert(document.querySelector("#plannerRosterBody tr[data-player-id]"), "Selected Planner refresh must restore the roster.");
      assert(document.documentElement.scrollWidth <= innerWidth, "Selected Planner must not overflow horizontally.");
      assert(errors.length === 0, "Console/runtime errors occurred: " + errors.join(" | "));
      finish("passed", "planner-selected: selected club workspace replaced search from parser-time first paint through hydration.");
      return;
    }

    if (scenario === "planner") {
      const input = document.getElementById("plannerTeamSearchInput");
      assert(input.getBoundingClientRect().width <= 520, "Planner search must stay within its widened 520px limit.");
      await waitFor(() => document.querySelectorAll(".plannerTeamSearchResult").length === 3, "Planner empty search owned-club results");
      assert(Array.from(document.querySelectorAll(".plannerTeamSearchResult")).map(el => el.dataset.clubId).join(",") === "9002,9001,9003", "Owned clubs must sort Diamond to Flint, then alphabetically inside divisions.");
      assert(text("#plannerTeamSearchResults").includes("Browser Club") && myClubsRequests.ownership >= 1, "Empty Planner search must show authenticated My Clubs results.");
      input.value = "Browser";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await waitFor(() => document.querySelector(".plannerTeamSearchResult"), "Planner team search");
      const teamResult = document.querySelector(".plannerTeamSearchResult");
      assert(teamResult instanceof HTMLButtonElement, "Planner team result is missing.");
      assert(teamResult.classList.contains("searchResult"), "Planner club results must retain the canonical searchResult highlight owner.");
      document.querySelector(".tablePageTitle").click();
      assert(!document.getElementById("plannerTeamSearchResults").hidden,"Team results must remain open after clicking outside a non-empty search.");
      input.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
      assert(!document.getElementById("plannerTeamSearchResults").hidden,"Escape must preserve results while the team query is non-empty.");

      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      assert(hidden("#plannerTeamSelector"), "Selected team must replace the search.");
      assert(!hidden("#plannerSelectedTeam"), "Selected team identity must be visible.");
      assert(text("#plannerTeamName") === "Browser Club", "Selected team name is missing.");
      assert(text("#plannerTeamDivision") === "Gold", "Selected team division is missing.");
      assert(JSON.parse(localStorage.getItem("mfl-club-display-data-v1") || "{}")["9001"]?.name === "Browser Club", "Planner selection must cache the Club identity for direct-refresh first paint.");
      assert(document.querySelector("#plannerSelectedTeam .myClubCard.plannerTeamCard"), "Selected team must use the canonical My Clubs card.");
      assert(document.querySelector("#plannerTeamCard .clubIdentityPrimary .clubIdentityName"), "Selected club name must match the Club page identity layout.");
      assert(document.getElementById("plannerTeamClearButton").parentElement === document.getElementById("plannerSelectedTeam"), "Clear must sit outside the selected club card.");
      assert(text("#plannerTeamId") === "Club #9001", "Selected team card must show its ID.");
      assert(document.getElementById("plannerTeamLogo").src.includes("/9001/logo.webp"), "Selected team logo is missing.");
      assert(location.search === "?club=9001", "Selected team URL is incorrect.");
      assert(!hidden("#plannerWorkspace") && !hidden(".plannerPitch"), "Selected team must expose squad and pitch.");
      const formation = document.getElementById("plannerFormationSelect");
      const formationCodes = ["3421","343","343b","352","352b","41212","41212narrow","4132","4141","4222","4231","424","4312","4321","433","433a","433d","433cf","4411","442","442b","523","532","541","541f"];
      assert(formation instanceof HTMLSelectElement, "Planner must offer a formation selector.");
      assert(JSON.stringify(Array.from(formation.options, option => option.value)) === JSON.stringify(formationCodes), "Planner formation choices or order differ from the requested list.");
      assert(formation.value === "442", "Planner must start in the default 4-4-2.");
      assert(formation.getAttribute("data-mfl-dropdown-enhanced") === "true", "Planner must use the canonical dropdown styling before hydration.");
      const initialSpots = Array.from(document.querySelectorAll("#plannerFormationPositions .plannerFormationSpot"), spot => spot.style.left + ":" + spot.style.top);
      assert(JSON.stringify(Array.from(document.querySelectorAll("#plannerFormationPositions .plannerFormationSpot"), spot => spot.querySelector(".plannerFormationPositionLabel")?.textContent)) === JSON.stringify(["LB","CB","CB","RB","LM","CM","CM","RM","ST","ST","GK"]), "4-4-2 must render all confirmed position labels.");
      assert(initialSpots.length === 11, "Planner formation preview must show ten outfield players plus the goalkeeper.");
      const initialToken = document.querySelector("#plannerFormationPositions [data-slot-token='true']");
      assert(getComputedStyle(initialToken).backgroundColor === "rgba(0, 0, 0, 0.2)", "Planner slot background must match the translucent black reference token.");
      assert(document.querySelectorAll("#plannerFormationPositions .plannerFormationTokenRing path").length === 132, "Each Planner ring must have twelve segmented arcs.");
      assert(document.querySelectorAll("#plannerFormationPositions .plannerFormationTokenPlus path").length === 22, "Each Planner token must contain the centered plus icon.");
      assert(document.querySelectorAll("#plannerFormationPositions .plannerFormationInstructionsBadge, #plannerFormationPositions .plannerFormationInstructionsIcon").length === 0, "Planner tokens must not render instruction badges.");
      assert(Number.parseFloat(initialSpots[0].split(":")[1]) === 78 && Number.parseFloat(initialSpots[8].split(":")[1]) === 18 && initialSpots[10].endsWith(":92%"), "4-4-2 must place defenders near the goalkeeper and attackers at the top.");
      formation.value = "4231";
      formation.dispatchEvent(new Event("change", { bubbles: true }));
      const changedSpots = Array.from(document.querySelectorAll("#plannerFormationPositions .plannerFormationSpot"), spot => spot.style.left + ":" + spot.style.top);
      assert(changedSpots.length === 11 && JSON.stringify(changedSpots) !== JSON.stringify(initialSpots), "Changing formation must rearrange eleven visible position markers.");
      assert(Number.parseFloat(changedSpots[0].split(":")[1]) === 78 && Number.parseFloat(changedSpots[9].split(":")[1]) === 18 && changedSpots[10].endsWith(":92%"), "4-2-3-1 must preserve the defender-to-attacker pitch orientation and goalkeeper position.");
      assert(localStorage.getItem("mfl-planner-formation-v1:9001") === "4231", "Planner must remember the formation for the selected club.");
      const approvedPositionSlots = {"343":[["CB","CB","CB"],["LM","CM","CM","RM"],["LW","ST","RW"]],"352":[["CB","CB","CB"],["LM","CDM","CM","CM","RM"],["ST","ST"]],"424":[["LB","CB","CB","RB"],["CM","CM"],["LW","ST","ST","RW"]],"433":[["LB","CB","CB","RB"],["CM","CM","CM"],["LW","ST","RW"]],"442":[["LB","CB","CB","RB"],["LM","CM","CM","RM"],["ST","ST"]],"523":[["LWB","CB","CB","CB","RWB"],["CM","CM"],["LW","ST","RW"]],"532":[["LWB","CB","CB","CB","RWB"],["LM","CM","RM"],["ST","ST"]],"541":[["LWB","CB","CB","CB","RWB"],["LM","CDM","CAM","RM"],["ST"]],"3421":[["CB","CB","CB"],["LM","CM","CM","RM"],["CF","CF"],["ST"]],"4132":[["LB","CB","CB","RB"],["CDM"],["LM","CM","RM"],["ST","ST"]],"4141":[["LB","CB","CB","RB"],["CDM"],["LM","CM","CM","RM"],["ST"]],"4222":[["LB","CB","CB","RB"],["CDM","CDM"],["CAM","CAM"],["ST","ST"]],"4231":[["LB","CB","CB","RB"],["CDM","CDM"],["LM","CAM","RM"],["ST"]],"4312":[["LB","CB","CB","RB"],["CM","CM","CM"],["CAM"],["ST","ST"]],"4321":[["LB","CB","CB","RB"],["CM","CM","CM"],["CF","CF"],["ST"]],"4411":[["LB","CB","CB","RB"],["LM","CM","CM","RM"],["CF"],["ST"]],"41212":[["LB","CB","CB","RB"],["CDM"],["LM","RM"],["CAM"],["ST","ST"]],"343b":[["CB","CB","CB"],["LM","CDM","CAM","RM"],["LW","ST","RW"]],"352b":[["CB","CB","CB"],["LM","CDM","CDM","CAM","RM"],["ST","ST"]],"41212narrow":[["LB","CB","CB","RB"],["CDM"],["CM","CM"],["CAM"],["ST","ST"]],"433a":[["LB","CB","CB","RB"],["CM","CAM","CM"],["LW","ST","RW"]],"433d":[["LB","CB","CB","RB"],["CM","CDM","CM"],["LW","ST","RW"]],"433cf":[["LB","CB","CB","RB"],["CM","CM","CM"],["LW","CF","RW"]],"442b":[["LB","CB","CB","RB"],["LM","CDM","CDM","RM"],["ST","ST"]],"541f":[["LWB","CB","CB","CB","RWB"],["LM","CM","CM","RM"],["ST"]]};
      const formationPreview = window.__mflPlannerFormationPreview;
      for (const code of formationCodes) {
        formationPreview.render(code);
        const spots = Array.from(document.querySelectorAll("#plannerFormationPositions .plannerFormationSpot"));
        assert(JSON.stringify(spots.map(spot => spot.dataset.position)) === JSON.stringify([...approvedPositionSlots[code].flat(), "GK"]), "Incorrect position markers for formation " + code);
        assert(spots.every(spot => spot.querySelector(".plannerFormationPositionLabel")?.textContent === spot.dataset.position), "Unlabeled position marker for formation " + code);
        assert(spots.every(spot => spot.querySelector("[data-slot-token='true'] .plannerFormationTokenRing")?.childElementCount === 12), "Incorrect segmented ring for formation " + code);
        assert(spots.every(spot => spot.querySelector(".plannerFormationTokenPlus")?.childElementCount === 2), "Incorrect plus icon for formation " + code);
        assert(spots.at(-1)?.style.top === "92%", "Goalkeeper must remain in place for formation " + code);
      }
      for (const code of ["343b","352b","541"]) {
        formationPreview.render(code);
        const spots = Array.from(document.querySelectorAll("#plannerFormationPositions .plannerFormationSpot"));
        const cdms = spots.filter(spot => spot.dataset.position === "CDM");
        const cams = spots.filter(spot => spot.dataset.position === "CAM");
        assert(cdms.some(cdm => cams.some(cam => Number.parseFloat(cdm.style.top) > Number.parseFloat(cam.style.top))), "Defensive and attacking midfield markers must have distinct depths in " + code);
      }
      formationPreview.render("4231");
      assert(localStorage.getItem("mfl-planner-formation-v1:9001") === "4231", "Rendering position slots must not alter the club's saved formation.");
      await waitFor(() => document.querySelector("#plannerRosterBody tr[data-player-id]"), "Planner current roster");
      assert(text("#plannerRosterBody td:nth-child(2)").includes("Browser Player"), "Planner must display the canonical current squad.");
      assert(text("#plannerRosterBody tr[data-player-id] td:nth-child(4)") === "23", "Planner must show player age.");
      const squadPlayer = document.querySelector("#plannerRosterBody tr[data-player-id]");
      for (const index of [2, 3, 4]) {
        assert(getComputedStyle(squadPlayer.children[index]).textAlign === "left", "Squad Position, Age and Overall must align left.");
      }
      assert(squadPlayer.querySelector("td:nth-child(5) .tableOverallRarityCircle.plannerOverallRarityCircle")?.style.backgroundColor, "Squad Overall must show the canonical rarity dot.");
      assert(text("#plannerAverageAge") === "Avg 23.00", "Planner totals row must show average age.");
      assert(text("#plannerAverageOverall") === "Avg 80.00", "Planner totals row must show average overall.");
      assert(text("#plannerTotalContracts") === "Total 12.50%", "Planner totals row must show total contracts.");
      const squadFlag = document.querySelector("#plannerRosterBody .plannerPlayerSearchFlag");
      assert(squadFlag?.getAttribute("data-tooltip") === "Italy", "Squad flags must expose the canonical nationality tooltip.");
      const ageMarker = document.querySelector("#plannerRosterBody .plannerAgeMarker");
      assert(ageMarker instanceof HTMLElement && ageMarker.classList.contains("retirementMarker--retiring-2"), "Planner must show the canonical retirement marker beside Age.");
      const contractValue = document.querySelector("#plannerRosterBody .plannerContractValue");
      const contractEditor = document.querySelector("#plannerRosterBody .plannerContractEditor");
      const contractInput = document.querySelector("#plannerRosterBody .plannerContractInput");
      const contractEdit = document.querySelector("#plannerRosterBody .plannerContractEditButton");
      assert(contractValue instanceof HTMLElement && contractValue.textContent === "12.50%", "Planner Contract must display database revenue share divided by 100.");
      assert(contractEditor instanceof HTMLElement && contractEditor.hidden, "Planner Contract editor must be hidden outside edit mode.");
      assert(contractInput instanceof HTMLInputElement, "Planner Contract input is missing.");
      assert(contractEdit instanceof HTMLButtonElement && contractEdit.textContent === "✎", "Planner Contract must expose an Edit button beside the normal value.");
      contractEdit.click();
      assert(!contractEditor.hidden && contractEdit.textContent === "✓", "Planner Contract Edit must reveal the editor and become Confirm.");
      assert(contractInput.getAttribute("data-min") === "0" && contractInput.getAttribute("data-max") === "20", "Planner Contract must expose the 0.00–20.00 decimal boundary.");
      assert(document.activeElement === contractInput, "Planner Contract must focus the active editor.");
      contractInput.value = "20.75";
      contractInput.dispatchEvent(new Event("input", { bubbles: true }));
      assert(contractInput.value === "20.00", "Planner Contract must clamp values above 20.00.");
      contractInput.value = "18,25";
      contractInput.dispatchEvent(new Event("input", { bubbles: true }));
      assert(contractInput.value === "18.25", "Planner Contract editor must normalize decimals to a dot separator.");
      const firstStepperButtons = contractEditor.querySelectorAll(".plannerContractStepper button");
      assert(firstStepperButtons.length === 2 && firstStepperButtons[0].textContent === "▲" && firstStepperButtons[1].textContent === "▼", "Planner Contract must use the site-style custom stepper.");
      firstStepperButtons[0].click();
      assert(contractInput.value === "19.25", "Planner Contract increase arrow must increment by 1.00.");
      firstStepperButtons[1].click();
      assert(contractInput.value === "18.25", "Planner Contract decrease arrow must decrement by 1.00.");
      const removeButton = document.querySelector(".plannerRosterRemove");
      const removeStyle = getComputedStyle(removeButton);
      assert(removeButton.textContent === "×", "Planner Remove must render as a red X glyph.");
      assert(removeStyle.backgroundColor === "rgba(0, 0, 0, 0)" && parseFloat(removeStyle.borderTopWidth) === 0, "Planner Remove must have no surrounding box.");
      assert(removeStyle.color !== getComputedStyle(document.body).color, "Planner Remove must use destructive coloring.");
      removeButton.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      assert(getComputedStyle(removeButton).backgroundColor === "rgba(0, 0, 0, 0)", "Planner Remove hover must keep the X background transparent.");
      const addPlayerButton = document.getElementById("plannerAddPlayerButton");
      addPlayerButton.click();
      assert(!hidden("#plannerPlayerModal"), "Add player must open the Add players modal.");
      assert(document.getElementById("plannerPlayerModal").classList.contains("modalOpen"), "Add players modal must enter the canonical modalOpen state.");
      assert(document.getElementById("plannerPlayerModal").parentElement === document.body, "Add players modal must portal to body so it paints above the fixed header.");
      const playerSearch = document.getElementById("plannerPlayerSearchInput");
      const playerModalBox = document.querySelector(".plannerPlayerDialog").getBoundingClientRect();
      assert(playerModalBox.width >= Math.min(900, innerWidth - 60), "Planner Add players modal must use the enlarged table layout.");
      playerSearch.value = "Player Browser";
      playerSearch.dispatchEvent(new Event("input", { bubbles: true }));
      await waitFor(() => document.querySelector('.plannerPlayerSearchResult[data-player-id="1"]'), "Planner current-squad player search");
      const ownPlayerSearchRow = document.querySelector('.plannerPlayerSearchResult[data-player-id="1"]');
      assert(ownPlayerSearchRow.children.length === 6, "Planner player search must use the six-column result table.");
      assert(ownPlayerSearchRow.querySelector(".plannerPlayerSearchFlag"), "Planner player search must render the nationality flag.");
      assert(ownPlayerSearchRow.children[1].textContent === "Browser Player", "Planner player-search table must show the player name.");
      assert(ownPlayerSearchRow.children[2].textContent === "ST", "Planner player-search table must show positions.");
      assert(ownPlayerSearchRow.children[3].textContent === "23", "Planner player-search table must show age.");
      assert(ownPlayerSearchRow.children[4].textContent === "80", "Planner player-search table must show overall.");
      for (const index of [2, 3, 4]) {
        assert(getComputedStyle(ownPlayerSearchRow.children[index]).textAlign === "left", "Popup Position, Age and Overall must align left.");
      }
      assert(ownPlayerSearchRow.querySelector(".tableOverallRarityCircle.plannerOverallRarityCircle")?.style.backgroundColor, "Popup search Overall must show the rarity dot.");
      const inSquadAction = ownPlayerSearchRow.querySelector(".plannerPlayerActionText");
      assert(inSquadAction instanceof HTMLSpanElement && inSquadAction.getAttribute("aria-disabled") === "true" && inSquadAction.textContent === "In squad", "Matching current-squad players must remain visible as disabled In squad text.");
      assert(document.getElementById("plannerPlayerConfirmButton").textContent.trim() === "Add", "The modal confirmation action must be Add.");
      const modalFooter = document.querySelector(".plannerPlayerModalFooter");
      const footerButtons = modalFooter.querySelectorAll("button");
      assert(footerButtons.length === 2 && footerButtons[0].textContent.trim() === "Discard" && footerButtons[1].textContent.trim() === "Add", "Discard and Add must be grouped in the footer.");
      const actionStyle = getComputedStyle(inSquadAction);
      assert(["flex", "inline-flex"].includes(actionStyle.display) && actionStyle.alignItems === "center" && actionStyle.justifyContent === "center", "Planner action text must be vertically centered: " + JSON.stringify({ display: actionStyle.display, alignItems: actionStyle.alignItems, justifyContent: actionStyle.justifyContent, className: inSquadAction.className }));
      const footerStyle = getComputedStyle(modalFooter);
      assert(footerStyle.justifyContent === "flex-end", "Discard and Add must stay at the bottom right.");
      assert(getComputedStyle(inSquadAction).textDecorationLine === "none", "Planner action text must not underline.");
      assert(document.getElementById("plannerPlayerSearchMore").hidden, "Search must hide Load more when all matching players were returned.");
      assert(ownPlayerSearchRow.getBoundingClientRect().height <= 32, "Planner player-search rows must use the reduced compact height.");
      playerSearch.value = "Added";
      playerSearch.dispatchEvent(new Event("input", { bubbles: true }));
      await waitFor(() => document.querySelectorAll(".plannerPlayerSearchResult").length === 2, "Planner player search");
      const selectAction = document.querySelector('.plannerPlayerSearchResult[data-player-id="2"] .plannerPlayerActionText');
      assert(selectAction.textContent === "Select", "Eligible search results must expose Select as text.");
      selectAction.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      assert(getComputedStyle(selectAction).textDecorationLine === "none", "Select hover must not underline.");
      assert(!document.getElementById("plannerPlayerSearchMore").hidden, "Broad name search must offer more matching players.");
      document.getElementById("plannerPlayerSearchMore").click();
      await waitFor(() => document.querySelectorAll(".plannerPlayerSearchResult").length === 3, "Additional player search page");
      assert(document.querySelector('.plannerPlayerSearchResult[data-player-id="4"]'), "Additional matching players must be accessible through pagination.");
      assert(document.getElementById("plannerPlayerSearchMore").hidden, "Load more must disappear after the final page.");
      selectAction.click();
      document.querySelector('.plannerPlayerSearchResult[data-player-id="3"] .plannerPlayerActionText').click();
      assert(text("#plannerPlayerSelectionCount") === "2", "Planner modal must stage multiple players.");
      const selectedRows = document.querySelectorAll("#plannerPlayerSelectionBody .plannerPendingPlayer");
      assert(selectedRows.length === 2, "Selected players must render in the table below search results.");
      assert(selectedRows[0].children.length === 6 && selectedRows[1].children.length === 6, "Selected-player rows must mirror the six-column search table.");
      assert(selectedRows[0].querySelector(".plannerPlayerActionText")?.textContent === "Remove", "Selected-player table must expose a plain-text Remove action.");
      assert(selectedRows[0].querySelector(".tableOverallRarityCircle.plannerOverallRarityCircle")?.style.backgroundColor, "Selected-player table must also show the rarity dot.");
      for (const index of [2, 3, 4]) {
        assert(getComputedStyle(selectedRows[0].children[index]).textAlign === "left", "Selected table Position, Age and Overall must align left.");
      }
      assert(!document.querySelector('#plannerRosterBody tr[data-player-id="2"]') && !document.querySelector('#plannerRosterBody tr[data-player-id="3"]'), "Staged modal selections must not mutate the squad.");
      document.getElementById("plannerPlayerDiscardButton").click();
      assert(hidden("#plannerPlayerModal"), "Discard must close the Add players modal.");
      assert(!document.querySelector('#plannerRosterBody tr[data-player-id="2"]') && !document.querySelector('#plannerRosterBody tr[data-player-id="3"]'), "Discard must leave the squad unchanged.");

      addPlayerButton.click();
      playerSearch.value = "Added";
      playerSearch.dispatchEvent(new Event("input", { bubbles: true }));
      await waitFor(() => document.querySelectorAll(".plannerPlayerSearchResult").length === 2, "Planner player search after discard");
      document.querySelector('.plannerPlayerSearchResult[data-player-id="2"] .plannerPlayerActionText').click();
      document.querySelector('.plannerPlayerSearchResult[data-player-id="3"] .plannerPlayerActionText').click();
      document.getElementById("plannerPlayerConfirmButton").click();
      assert(hidden("#plannerPlayerModal"), "Add selected must close the modal.");
      const addedRow = document.querySelector('#plannerRosterBody tr[data-player-id="2"]');
      const addedDefenderRow = document.querySelector('#plannerRosterBody tr[data-player-id="3"]');
      assert(addedRow && addedDefenderRow, "Add selected must append every staged eligible player.");
      const sortedPlannerIds = Array.from(document.querySelectorAll("#plannerRosterBody tr[data-player-id]")).map(row => row.dataset.playerId);
      assert(JSON.stringify(sortedPlannerIds) === JSON.stringify(["3","2","1"]), "Planner roster must sort by canonical primary-position order.");
      assert(text("#plannerAverageAge") === "Avg 22.00", "Planner totals row must update average age after multi-add.");
      assert(text("#plannerAverageOverall") === "Avg 77.67", "Planner totals row must update average overall after multi-add.");
      assert(text("#plannerTotalContracts") === "Total 20.75%", "Planner totals row must update total contracts after multi-add.");
      assert(addedRow.querySelector(".plannerContractValue")?.textContent === "3.75%", "Added player Contract must also use database value divided by 100.");
      assert(addedRow.querySelector(".newMintMarker"), "Added one-season player must show the New mint marker.");
      const addedContractValue = addedRow.querySelector(".plannerContractValue");
      const addedContractEditor = addedRow.querySelector(".plannerContractEditor");
      const addedContractEdit = addedRow.querySelector(".plannerContractEditButton");
      assert(addedContractEdit instanceof HTMLButtonElement, "Added player Contract Edit is missing.");
      addedContractEdit.click();
      assert(contractEditor.hidden, "Opening another Contract must close the previous editor.");
      assert(contractValue.textContent === "12.50%", "Opening another Contract must discard the previous unsaved draft.");
      assert(addedContractEditor instanceof HTMLElement && !addedContractEditor.hidden, "The newly selected Contract must become the only active editor.");
      assert(addedContractValue?.textContent === "3.75%", "Switching editors must preserve the new Contract's committed value.");
      addedContractEdit.click();
      contractEdit.click();
      contractInput.value = "18.25";
      contractInput.dispatchEvent(new Event("input", { bubbles: true }));
      contractEdit.click();
      assert(contractValue.textContent === "18.25%" && contractEditor.hidden && contractEdit.textContent === "✎", "Explicit Contract confirmation must persist before later roster changes.");
      // Clickable starters and backup lists use the same roster-derived depth source.
      const fixture = [
        ...[91,88,85,83,80,76].map((overall,index) => ({player_id:101+index,name:"CB "+overall,positions:"CB",overall,retirement_years:5})),
        {player_id:107,name:"ST 93",positions:"ST",overall:93,retirement_years:5},
        {player_id:108,name:"GK 82",positions:"GK",overall:82,retirement_years:5},
        {player_id:109,name:"Retired CB",positions:"CB",overall:99,retirement_years:0},
      ];
      const slot = key => document.querySelector('#plannerFormationPositions .plannerFormationSpot[data-slot-key="'+key+'"]');
      formationPreview.setRoster(fixture);
      formationPreview.render("442");
      assert(slot("CB#1")?.querySelector(".plannerFormationToken")?.getBoundingClientRect().width>44, "Planner circles must be enlarged.");
      const fillButton = document.getElementById("plannerAutoFillDepthButton");
      const depthPicker = document.getElementById("plannerDepthPicker");
      assert(fillButton instanceof HTMLButtonElement && !fillButton.disabled, "Auto-fill must be available for eligible empty circles.");
      slot("CB#1").querySelector(".plannerFormationSlotButton").click();
      assert(!depthPicker.hidden, "Clicking an empty circle must open the position selector.");
      assert(Array.from(depthPicker.querySelectorAll(".plannerDepthPickerPlayer"),row=>row.dataset.playerId).join(",")==="101,102,103,104,105,106","Picker must include every eligible non-retired player in Overall order.");
      depthPicker.querySelector('.plannerDepthPickerPlayer[data-player-id="103"]').click();
      assert(slot("CB#1")?.dataset.playerId==="103" && depthPicker.hidden,"Selecting a player must fill only the chosen circle.");
      const assignedToken = slot("CB#1").querySelector(".plannerFormationTokenAssigned");
      const assignedPortrait = assignedToken?.querySelector(".plannerFormationPlayerPhoto");
      assert(assignedToken?.children.length === 2 && assignedToken.firstElementChild?.classList.contains("plannerFormationPlayerGradient"),"Assigned circle must contain only the club gradient and player portrait.");
      assert(assignedPortrait?.src.includes("/103/photo.webp") && assignedPortrait.alt === "","The assigned portrait must match the chosen player.");
      assert(getComputedStyle(assignedPortrait).objectFit === "contain" && getComputedStyle(assignedPortrait).objectPosition === "50% 0%" && getComputedStyle(assignedPortrait).transform !== "none","Player portrait must use the original face-focused zoom inside the gradient circle.");
      assert(!assignedToken.querySelector("svg, .plannerFormationPlayerSliders, .plannerFormationPlayerShade"),"Assigned circle must not overlay a clipped icon or dark shade.");
      assert(slot("CB#1").querySelector(".plannerFormationPlayerBadge")?.textContent==="85CB","Filled circle must show Overall and position.");
      assert(slot("CB#1").querySelectorAll(".plannerFormationBackup").length===2,"Filled circle must show 2nd and 3rd alternatives.");
      fillButton.click();
      assert(slot("CB#1")?.dataset.playerId==="103" && slot("CB#2")?.dataset.playerId==="101","Auto-fill must preserve manual assignment and avoid duplicate starters.");
      assert(!slot("CB#1").querySelector(".plannerFormationBackups")?.textContent.includes("CB 91"),"Alternative list must exclude other starters.");
      slot("CB#1").querySelector(".plannerFormationSlotButton").click();
      assert(depthPicker.querySelector(".plannerDepthPickerClear") && !depthPicker.querySelector('.plannerDepthPickerPlayer[data-player-id="101"]'),"Occupied circle must allow clearing/replacement without selecting another starter.");
      depthPicker.querySelector(".plannerDepthPickerClear").click();
      assert(!slot("CB#1")?.dataset.playerId && slot("CB#2")?.dataset.playerId==="101","Clear must affect the selected circle only.");
      formationPreview.render("433");
      assert(slot("CB#2")?.dataset.playerId==="101","Compatible assignments must survive a formation change.");
      // Auto-fill must stay available for a repeated slot even if round-robin backups
      // currently land in its occupied sibling's depth column.
      formationPreview.setRoster([
        {player_id:201,name:"CB 95",positions:"CB",overall:95,retirement_years:5},
        {player_id:202,name:"CB 90",positions:"CB",overall:90,retirement_years:5},
      ]);
      formationPreview.render("442");
      slot("CB#1").querySelector(".plannerFormationSlotButton").click();
      depthPicker.querySelector('.plannerDepthPickerPlayer[data-player-id="201"]').click();
      assert(!fillButton.disabled,"Auto-fill must remain available when CB #2 has one eligible player.");
      fillButton.click();
      assert(slot("CB#2")?.dataset.playerId==="202","Auto-fill must use the remaining eligible player in the repeated slot.");
      formationPreview.setRoster([{player_id:107,name:"ST 93",positions:"ST",overall:93}]);
      assert(!slot("CB#2")?.dataset.playerId,"Removed players must be dropped from depth assignments.");
      formationPreview.setRoster([
        {player_id:1,name:"Browser Player",positions:"ST",overall:80,retirement_years:2},
        {player_id:2,name:"Added Browser Player",positions:"RW",overall:77,retirement_years:4},
        {player_id:3,name:"Added Browser Defender",positions:"CB",overall:76,retirement_years:5},
      ]);
      formationPreview.render("4231");
      assert(text("#plannerPitchHeading") === "Depth", "Planner pitch section must be renamed Depth.");
      const squadHeadingBox = document.getElementById("plannerRosterHeading").getBoundingClientRect();
      const depthHeadingBox = document.getElementById("plannerPitchHeading").getBoundingClientRect();
      assert(Math.abs(squadHeadingBox.top - depthHeadingBox.top) <= 1, "Depth heading must align vertically with Squad.");
      const squadBox = document.querySelector(".plannerRosterPanel").getBoundingClientRect();
      const pitchBox = document.querySelector(".plannerPitchPanel").getBoundingClientRect();
      const pitchSurfaceBox = document.querySelector(".plannerPitch").getBoundingClientRect();
      assert(getComputedStyle(document.querySelector(".plannerPitch")).backgroundImage.includes("pitch-background.svg"), "Hydrated Planner must retain the shared SVG pitch.");
      assert(Math.abs(pitchSurfaceBox.width / pitchSurfaceBox.height - 72 / 109) < 0.01, "Planner pitch must keep the supplied SVG proportions.");
      if (innerWidth > 800) {
        assert(pitchBox.left - squadBox.right >= 30, "Pitch must keep a safe gutter from the squad table.");
        assert(pitchSurfaceBox.width > 280 && pitchSurfaceBox.width <= 420, "Desktop Planner Depth pitch must remain centered at the reduced 420px maximum.");
        assert(pitchSurfaceBox.width <= pitchBox.width - 12, "Planner Depth pitch must stay comfortably within plannerPitchPanel.");
        assert(pitchSurfaceBox.top - depthHeadingBox.bottom <= 18, "Planner Depth pitch must sit just below its formation controls.");
      }
      else assert(pitchBox.top >= squadBox.bottom, "Mobile Planner must stack squad and pitch.");
      document.querySelector('#plannerRosterBody tr[data-player-id="2"] .plannerRosterRemove').click();
      document.querySelector('#plannerRosterBody tr[data-player-id="3"] .plannerRosterRemove').click();
      assert(!document.querySelector('#plannerRosterBody tr[data-player-id="2"]') && !document.querySelector('#plannerRosterBody tr[data-player-id="3"]'), "Remove must update the planned squad.");
      assert(document.querySelector('#plannerRosterBody tr[data-player-id="1"]'), "Removing added players must keep the original planned player.");
      document.querySelector('#plannerRosterBody tr[data-player-id="1"] .plannerRosterRemove').click();
      assert(!document.querySelector("#plannerRosterBody tr[data-player-id]"), "Removing the remaining player must empty the planned squad.");
      assert(text("#plannerRosterStatus") === "No players in this squad.", "Empty planned squad must be explicit.");
      document.getElementById("plannerTeamClearButton").click();
      assert(!hidden("#plannerTeamSelector") && hidden("#plannerSelectedTeam"), "Clear must restore search.");
      assert(input.value === "" && location.search === "", "Clear must reset the team and URL.");
      assert(formation.value === "442", "Clearing a club must reset the visible formation preview.");
      assert(hidden("#plannerWorkspace"), "Clear must hide the workspace.");
      await waitFor(() => document.querySelectorAll(".plannerTeamSearchResult").length === 3, "Planner owned clubs after Clear");
      assert(Array.from(document.querySelectorAll(".plannerTeamSearchResult")).map(el => el.dataset.clubId).join(",") === "9002,9001,9003", "Clear must restore division-sorted owned clubs.");
      history.replaceState({}, "", "/planner?club=9001");
      await window.__mflPlannerRoute.render(false);
      assert(hidden("#plannerTeamSelector") && text("#plannerTeamName") === "Browser Club", "URL restoration must restore the team identity.");
      await waitFor(() => document.querySelector("#plannerRosterBody tr[data-player-id]"), "Restored Planner roster");
      assert(document.documentElement.scrollWidth <= innerWidth, "Planner must not overflow horizontally.");
      assert(errors.length === 0, "Console/runtime errors occurred: " + errors.join(" | "));
      finish(
        "passed",
        "planner: stable first paint, selected-team identity, current roster/removal and responsive pitch workspace.",
      );
      return;
    }

    if (scenario.endsWith("-empty")) {
      assert(errors.length === 0, "Console/runtime errors occurred: " + errors.join(" | "));
      finish("passed", scenario + ": URL-filtered direct refresh committed the authoritative empty table state.");
      return;
    }
    if (scenario === "database-linked-state") {
      assert(errors.length === 0, "Console/runtime errors occurred: " + errors.join(" | "));
      finish(
        "passed",
        "database-linked-state: refresh kept linked filter count and sorting authoritative through every sampled paint.",
      );
      return;
    }

    await navigateBackToScenario(setPage, timeline);
    await assertStickyNameSeparator();
    assertSharedChromeGeometry();
    assertPageAccessibilityState();
    const spaState = routeState();
    assertRouteState(spaState);
    assert(
      JSON.stringify(spaState) === JSON.stringify(directState),
      scenario + " direct refresh and SPA navigation did not converge to the same canonical state.",
    );
    assert(errors.length === 0, "Console/runtime errors occurred: " + errors.join(" | "));
    finish("passed", scenario + ": direct refresh and SPA navigation converged with canonical timing and no runtime errors.");
  }

  async function runStaleNavigation() {
    const runPageTransition = window.__mflRunPageTransition;
    const transitionIsCurrent = window.__mflNavigationTransitionIsCurrent;
    const timeline = window.__mflClientPerformance;
    assert(typeof runPageTransition === "function", "Canonical page transition runner is unavailable.");
    assert(typeof transitionIsCurrent === "function", "Canonical transition identity check is unavailable.");
    assert(timeline && typeof timeline.snapshot === "function", "Client performance timeline is unavailable.");

    await delay(80);
    const baselineSequence = timeline.snapshot().at(-1)?.sequence || 0;
    let staleCommitted = false;

    const staleTransition = runPageTransition("changelog", true, {}, async (transition) => {
      await delay(180);
      if (transitionIsCurrent(transition)) {
        staleCommitted = true;
        document.documentElement.dataset.browserRouteCommit = "changelog";
      }
      return "stale";
    });

    await delay(60);
    const currentTransition = runPageTransition("privacy", true, {}, async (transition) => {
      assert(transitionIsCurrent(transition), "Latest transition was stale before its authoritative commit.");
      document.documentElement.dataset.browserRouteCommit = "privacy";
      return "current";
    });

    const [staleResult, currentResult] = await Promise.all([staleTransition, currentTransition]);
    await delay(100);

    assert(staleResult === null, "Superseded transition did not resolve as stale.");
    assert(currentResult === "current", "Latest transition did not complete normally.");
    assert(staleCommitted === false, "Superseded transition committed after a newer route won.");
    assert(window.location.pathname === "/privacy", "Expected /privacy, got " + window.location.pathname + ".");
    assert(document.documentElement.dataset.browserRouteCommit === "privacy", "Latest route content did not remain authoritative.");
    assertSpaTimingAfter(timeline, baselineSequence);
    assert(errors.length === 0, "Console/runtime errors occurred: " + errors.join(" | "));
    finish("passed", "stale navigation: newest route remained authoritative with canonical timing.");
  }

  async function run() {
    try {
      if (scenario === "stale") await runStaleNavigation();
      else await runRepresentativeRoute();
    } catch (error) {
      finish("failed", String(error?.stack || error));
    }
  }

  if (document.documentElement.dataset.mflReady === "true") {
    queueMicrotask(run);
  } else {
    window.addEventListener("mfl:ready", () => void run(), { once: true });
  }
})();`;

function browserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error("Browser routing regression requires Chrome or Chromium on PATH.");
}

function contentType(pathname) {
  return ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
  })[extname(pathname).toLowerCase()] || "application/octet-stream";
}

function writeJson(response, data, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function pageDataStub(url, scenario = "") {
  const scope = String(url.searchParams.get("scope") || "database").toLowerCase();
  let rules = [];
  try {
    const parsed = JSON.parse(String(url.searchParams.get("filters") || "[]"));
    if (Array.isArray(parsed)) rules = parsed;
  } catch {
    rules = [];
  }
  const filteredEmpty = rules.some((rule) => (
    rule?.column === "overall"
    && rule?.operator === ">="
    && Number(rule?.value) === 99
  ));
  const requestedClubId = String(url.searchParams.get("clubId") || "").trim();
  const clubFixtures = {
    "9001": {
      clubId: "9001",
      name: "Browser Club",
      division: 3,
      city: "Bologna",
      nation: "ITALY",
      primaryColor: "#112233",
      secondaryColor: "#445566",
      ownerWalletAddress: "0x3333333333333333",
      ownerName: "Browser Owner",
      logoUrl: browserClubLogo9001,
    },
    "9002": {
      clubId: "9002",
      name: "Second Browser Club",
      division: 4,
      city: "Rome",
      nation: "ITALY",
      primaryColor: "#223344",
      secondaryColor: "#556677",
      ownerWalletAddress: "0x4444444444444444",
      ownerName: "Second Browser Owner",
      logoUrl: browserClubLogo9002,
    },
  };
  const plannerRow = pageColumns.map((column) => (
    column === "retirement_years" ? 2 : (testPlayer[column] ?? null)
  ));
  const rows = scope === "club" ? (["planner", "planner-selected"].includes(scenario) ? [plannerRow] : []) : (filteredEmpty ? [] : [rowForColumns(pageColumns)]);
  const requestedPageSize = Number(url.searchParams.get("pageSize"));
  const pageSize = scope === "mflstats"
    ? rows.length
    : (Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? Math.trunc(requestedPageSize) : 100);
  return {
    columns: pageColumns,
    rows,
    ...(scope === "club" ? { club: clubFixtures[requestedClubId] || null } : {}),
    page: 1,
    pageSize,
    totalRows: rows.length,
    sourceRows: filteredEmpty ? 1 : rows.length,
    totalPages: 1,
    generatedAt,
    marketplaceEmbedded: false,
    marketplaceGeneratedAt: "",
    marketplaceFlowBlockHeight: 0,
    source: "browser-regression",
  };
}

function dataStub(url, scenario = "") {
  const mode = String(url.searchParams.get("mode") || "bootstrap");
  if (mode === "bootstrap") {
    return {
      manifest: {
        generated_at: generatedAt,
        row_count: 1,
        wallet_count: 1,
        source: "browser-regression",
        columns: publicColumns,
        progression_columns: [],
        search_player_columns: searchColumns,
      },
      summary: { playerCount: 1, walletCount: 1, generatedAt },
      players: { columns: searchColumns, rows: [] },
      agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [] },
      clubs: [],
      searchMode: "sqlite-runtime",
    };
  }
  if (mode === "my-clubs") {
    return {
      generatedAt,
      clubs: [{
        clubId: "9001",
        name: "Browser Club",
        division: 3,
        city: "Bologna",
        nation: "ITALY",
        logoUrl: browserClubLogo9001,
        primaryColor: "#112233",
        secondaryColor: "#445566",
      }, {
        clubId: "9002",
        name: "Second Browser Club",
        division: scenario === "planner" ? 1 : 4,
        city: "Rome",
        nation: "ITALY",
        logoUrl: browserClubLogo9002,
        primaryColor: "#223344",
        secondaryColor: "#556677",
      }, {
        clubId: "9003",
        name: "Unavailable Competition Club",
        division: scenario === "planner" ? 3 : 5,
        city: "Turin",
        nation: "ITALY",
        logoUrl: "",
        primaryColor: "#334455",
        secondaryColor: "#667788",
      }],
    };
  }
  if (mode === "my-clubs-competitions") {
    const requested = String(url.searchParams.get("clubIds") || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const fixtures = {
      "9001": [{
        competitionId: 7001,
        seasonNumber: 16,
        name: "Browser League",
        type: "LEAGUE",
        standing: { position: 2 },
      }],
      "9002": [{
        competitionId: 7002,
        seasonNumber: 16,
        name: "Browser Cup",
        type: "CUP",
        stage: "Semi-final",
      }],
      "9003": [],
    };
    return {
      generatedAt,
      competitionsByClub: Object.fromEntries(requested.map((clubId) => [clubId, fixtures[clubId] || []])),
    };
  }
  if (mode === "mfl-stats-summary") {
    return {
      generatedAt,
      totalPlayers: 1,
      columns: ["overall", "age", "category", "count"],
      rows: [[80, 23, "packable", 1]],
      source: "browser-regression-summary",
    };
  }
  if (mode === "search" && url.searchParams.get("type") === "clubs") {
    return { results: [{ clubId: "9001", name: "Browser Club", division: 3 }] };
  }
  if (mode === "search" && url.searchParams.get("type") === "players") {
    const q = String(url.searchParams.get("q") || "").toLowerCase();
    const columns = ["player_id", "name", "overall", "age", "nationality", "positions", "retirement_years", "player_seasons", "active_contract_revenue_share"];
    if (q.includes("player browser")) {
      return { columns, rows: [], hasMore: false };
    }
    if (q.includes("browser")) {
      return { columns, rows: [[1, "Browser Player", 80, 23, "Italy", "ST", 2, 5, 1250]], hasMore: false };
    }
    if (q.includes("added")) {
      const offset = Number(url.searchParams.get("offset") || 0);
      return offset > 0
        ? { columns, rows: [[4, "More Browser Player", 74, 25, "Spain", "CM", 5, 3, 200]], hasMore: false }
        : {
            columns,
            rows: [
              [2, "Added Browser Player", 77, 21, "Italy", "RW", 4, 1, 375],
              [3, "Added Browser Defender", 76, 22, "France", "CB", 5, 3, 450],
            ],
            hasMore: true,
          };
    }
  }
  if (mode === "search") {
    const playerIds = new Set(
      String(url.searchParams.get("playerIds") || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
    return {
      players: {
        columns: searchColumns,
        rows: playerIds.has("1") ? [rowForColumns(searchColumns)] : [],
      },
      agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [] },
      clubs: [],
    };
  }
  if (mode === "page") return pageDataStub(url, scenario);
  return {};
}

function walletPreferencesStub() {
  return {
    watchlists: [{ id: testWatchlistId, name: "Browser List", playerIds: ["1"] }],
    playerNotes: {},
    tableState: {},
  };
}

async function responseForStaticPath(pathname) {
  const routePath = pathname === "/" || !extname(pathname) ? "/index.html" : pathname;
  const candidate = resolve(siteDirectory, `.${routePath}`);
  if (candidate !== siteDirectory && !candidate.startsWith(`${siteDirectory}${sep}`)) return null;
  try {
    return { path: candidate, content: await readFile(candidate) };
  } catch {
    return null;
  }
}

async function createRegressionServer() {
  const indexPath = resolve(siteDirectory, "index.html");
  const indexHtml = await readFile(indexPath, "utf8");
  const injectedIndexHtml = indexHtml.replace(
    "<head>",
    '<head>\n    <script src="/__browser-routing-test.js"></script>',
  );

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/__browser-routing-test.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(browserTestSource);
      return;
    }
    if (url.pathname === "/api/data") {
      const myClubsMode = String(url.searchParams.get("mode") || "");
      const myClubsRequest = myClubsMode === "my-clubs" || myClubsMode === "my-clubs-competitions";
      const invalidMyClubsProof = myClubsRequest
        && String(request.headers["x-browser-regression-scenario"] || "") === "myclubs-stale";
      const competitionBatchFailure = myClubsMode === "my-clubs-competitions"
        && String(request.headers["x-browser-regression-scenario"] || "") === "myclubs-competition-fail";
      if (myClubsMode === "my-clubs" && !invalidMyClubsProof) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
      }
      if (myClubsMode === "my-clubs-competitions" && !invalidMyClubsProof) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 240));
      }
      if (myClubsMode === "page"
          && String(url.searchParams.get("scope") || "") === "club"
          && String(url.searchParams.get("clubId") || "") === "9001") {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 220));
      }
      writeJson(
        response,
        invalidMyClubsProof
          ? { error: "Invalid wallet proof." }
          : competitionBatchFailure
            ? { error: "Fixture competition batch unavailable." }
            : dataStub(url, String(request.headers["x-browser-regression-scenario"] || "")),
        invalidMyClubsProof ? 401 : competitionBatchFailure ? 500 : 200,
      );
      return;
    }
    if (url.pathname === "/api/mfl-season-ratios-v2") {
      writeJson(response, {
        ratios: [
          { season: 12, ratio: 320 },
          { season: 13, ratio: 340 },
          { season: 14, ratio: 360 },
          { season: 15, ratio: 380 },
        ],
        requestedAt: generatedAt,
      });
      return;
    }
    if (url.pathname === "/api/marketplace") {
      writeJson(response, { generatedAt, prices: {}, flowBlockHeight: 0 });
      return;
    }
    if (url.pathname === "/api/wallet-preferences") {
      writeJson(response, walletPreferencesStub());
      return;
    }
    if (url.pathname === "/api/wallet-permissions-version") {
      writeJson(response, { version: "browser-regression", updated_at: generatedAt });
      return;
    }
    if (url.pathname === "/api/wallet-access") {
      writeJson(response, { allowed: true, version: "browser-regression", updated_at: generatedAt });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      writeJson(response, {});
      return;
    }
    if (!extname(url.pathname)) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(injectedIndexHtml);
      return;
    }

    const asset = await responseForStaticPath(url.pathname);
    if (!asset) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(asset.path), "Cache-Control": "no-store" });
    response.end(asset.content);
  });

  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  return server;
}

async function reserveTcpPort() {
  const probe = createNetServer();
  await new Promise((resolvePromise, rejectPromise) => {
    probe.once("error", rejectPromise);
    probe.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = probe.address();
  assert(address && typeof address === "object", "Could not reserve a Chrome debugging port.");
  const port = address.port;
  await new Promise((resolvePromise) => probe.close(resolvePromise));
  return port;
}

async function waitForPageTarget(port, targetUrl) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = Array.isArray(targets)
          ? targets.find((entry) => entry?.type === "page" && String(entry?.url || "").startsWith(targetUrl))
          : null;
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {
      // Chrome may not have opened the debugging endpoint yet.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Chrome debugging target did not become ready.");
}

async function connectCdp(webSocketUrl) {
  const WebSocketConstructor = globalThis.WebSocket;
  if (typeof WebSocketConstructor !== "function") {
    throw new Error("Node runtime does not expose WebSocket for Chrome DevTools Protocol.");
  }
  const socket = new WebSocketConstructor(webSocketUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", rejectPromise, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message?.id || !pending.has(message.id)) return;
    const { resolve: resolvePromise, reject: rejectPromise } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) rejectPromise(new Error(JSON.stringify(message.error)));
    else resolvePromise(message.result || {});
  });

  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolvePromise, rejectPromise) => {
      pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  return {
    send,
    close() {
      socket.close();
    },
  };
}

async function waitForBrowserRegression(cdp) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const evaluation = await cdp.send("Runtime.evaluate", {
      expression: '(() => { const el = document.querySelector("#mflBrowserRoutingRegression"); return el ? { status: el.dataset.status || "", detail: el.textContent || "" } : null; })()',
      returnByValue: true,
    });
    const value = evaluation?.result?.value;
    if (value?.status === "passed") return value;
    if (value?.status === "failed") throw new Error(`Browser routing regression failed: ${value.detail}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Browser routing regression did not publish a result before timeout.");
}

async function runChromeRegression(executable, url, width = 1280, height = 900) {
  const debuggingPort = await reserveTcpPort();
  const userDataDirectory = await mkdtemp(join(tmpdir(), "mfl-browser-routing-"));
  const child = spawn(executable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--window-size=${width},${height}`,
    `--remote-debugging-port=${debuggingPort}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${userDataDirectory}`,
    url,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  let cdp = null;
  try {
    const target = await waitForPageTarget(debuggingPort, url);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    return await waitForBrowserRegression(cdp);
  } catch (error) {
    throw new Error(`${error.message}\n${stderr.slice(-2000)}`, { cause: error });
  } finally {
    cdp?.close();
    if (child.exitCode === null) {
      await new Promise((resolvePromise) => {
        child.once("close", resolvePromise);
        child.kill("SIGKILL");
      });
    }
    await rm(userDataDirectory, { recursive: true, force: true });
  }
}

const regressionScenarios = Object.freeze([
  ["stale", "/privacy"],
  ["database", "/database/attributes"],
  ["database-tablet", "/database/attributes", 800, 900],
  ["database-phone", "/database/attributes", 520, 900],
  ["database-empty", "/database/attributes?overall.gte=99"],
  ["database-linked-state", "/database/attributes?overall.gte=79&sort=age&direction=asc"],
  ["player", "/players/1"],
  ["player-1444", "/players/1", 1444, 900],
  ["player-1363", "/players/1", 1363, 900],
  ["player-1200", "/players/1", 1200, 900],
  ["player-1181", "/players/1", 1181, 900],
  ["player-1180", "/players/1", 1180, 900],
  ["player-1101", "/players/1", 1101, 900],
  ["player-1090", "/players/1", 1090, 900],
  ["player-1041", "/players/1", 1041, 900],
  ["player-1040", "/players/1", 1040, 900],
  ["player-980", "/players/1", 980, 900],
  ["player-901", "/players/1", 901, 900],
  ["watchlist", `/watchlist/${testWatchlistId}/current-season`],
  ["watchlist-empty", `/watchlist/${testWatchlistId}/current-season?overall.gte=99`],
  ["myclubs-out", "/my-clubs"],
  ["myclubs-in", "/my-clubs#opted-in"],
  ["myclubs-competition-fail", "/my-clubs#competition-fail"],
  ["myclubs-stale", "/my-clubs#stale-proof"],
  ["mflstats", "/mfl/stats"],
  ["planner", "/planner"],
  ["planner-out", "/planner#opted-out"],
  ["planner-selected", "/planner?club=9001"],
]);

const server = await createRegressionServer();
try {
  const address = server.address();
  assert(address && typeof address === "object", "Browser regression server did not expose a TCP address.");
  const executable = browserExecutable();

  for (const [scenario, path, width = 1280, height = 900] of regressionScenarios) {
    const url = `http://127.0.0.1:${address.port}${path}`;
    const result = await runChromeRegression(executable, url, width, height);
    assert.equal(result.status, "passed");
    console.log(`Browser routing regression passed: ${scenario}: ${result.detail}`);
  }
} finally {
  await new Promise((resolvePromise) => server.close(resolvePromise));
}