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
  player_seasons: 1,
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
  active_contract_revenue_share: 10,
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
  const scenario = window.location.pathname === "/privacy"
    ? "stale"
    : window.location.pathname.startsWith("/database/")
      ? (filteredEmpty ? "database-empty" : "database")
      : window.location.pathname.startsWith("/players/")
        ? "player"
        : window.location.pathname.startsWith("/watchlist/")
          ? (filteredEmpty ? "watchlist-empty" : "watchlist")
          : window.location.pathname === "/my-clubs/opted-out"
            ? "myclubs-out"
            : window.location.pathname === "/my-clubs"
              ? "myclubs"
              : window.location.pathname === "/mfl/stats"
                ? "mflstats"
                : "unknown";
  const testWallet = "0x1111111111111111";
  const testWatchlistId = "browser1";
  const expectedPlayerName = "Browser Player";
  const errors = [];
  let parserSnapshot = null;

  if (scenario === "watchlist" || scenario === "watchlist-empty" || scenario === "myclubs") {
    const proof = {
      type: "user-signature",
      address: testWallet,
      message: "MFL Front Office Dapper Opt-In",
      signingAddress: testWallet,
      signatures: [{ keyId: 0, addr: testWallet, signature: "browser-regression" }],
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
      storedWalletOptIn: String(root.dataset.storedWalletOptIn || ""),
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
    if (scenario === "database" || scenario === "database-empty") {
      assert(parserSnapshot.initialPage === "database/attributes", "Database first paint has the wrong initial path.");
      assert(parserSnapshot.initialTablePage === "database", "Database first paint has the wrong table-page owner.");
      assert(parserSnapshot.initialTableView === "attributes", "Database first paint has the wrong view.");
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
    } else if (scenario === "myclubs") {
      assert(parserSnapshot.initialPage === "my-clubs", "My Clubs first paint has the wrong initial path.");
      assert(parserSnapshot.storedWalletOptIn === "true", "My Clubs first paint did not recognize the stored opt-in.");
    } else if (scenario === "myclubs-out") {
      assert(parserSnapshot.initialPage === "my-clubs/opted-out", "My Clubs opted-out first paint has the wrong initial path.");
      assert(parserSnapshot.storedWalletOptIn === "false", "My Clubs opted-out first paint unexpectedly recognized an opt-in.");
    } else if (scenario === "mflstats") {
      assert(parserSnapshot.initialPage === "mfl/stats", "MFL Stats first paint has the wrong initial path.");
      assert(parserSnapshot.initialTablePage === "mfl", "MFL Stats first paint has the wrong table-page owner.");
      assert(parserSnapshot.initialTableView === "stats", "MFL Stats first paint has the wrong view.");
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
    if (scenario === "database" || scenario === "database-empty") {
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
      return {
        path: window.location.pathname,
        title: document.title,
        hasPlayerName: text("#playerDetail").includes(expectedPlayerName),
        pageHidden: hidden("#playerPage"),
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
    if (scenario === "myclubs") {
      return {
        path: window.location.pathname,
        title: document.title,
        pageHidden: hidden("#myClubsPage"),
        clubCards: document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length,
        clubText: text("#myClubsGrid"),
        statusText: text("#myClubsStatus"),
        lockedHidden: hidden("#myPlayersLockedPage"),
      };
    }
    if (scenario === "myclubs-out") {
      return {
        path: window.location.pathname,
        title: document.title,
        pageHidden: hidden("#myClubsPage"),
        lockedHidden: hidden("#myPlayersLockedPage"),
        lockedTitle: text("#optInLockedTitle"),
        lockedMessage: text("#optInLockedMessage"),
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
    } else if (scenario === "player") {
      assert(stateValue.path === "/players/1", "Player canonical path is wrong: " + stateValue.path);
      assert(stateValue.hasPlayerName, "Player detail did not render the fixture identity.");
      assert(stateValue.title === expectedPlayerName + " - MFL Front Office", "Player title is not the full player name.");
      assert(stateValue.pageHidden === false, "Player page remained hidden after readiness.");
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
    } else if (scenario === "myclubs") {
      assert(stateValue.path === "/my-clubs", "My Clubs canonical path is wrong: " + stateValue.path);
      assert(stateValue.pageHidden === false, "My Clubs page remained hidden after readiness.");
      assert(stateValue.clubCards === 1, "My Clubs did not render the fixture club card.");
      assert(stateValue.clubText.includes("Browser Club"), "My Clubs did not render fixture club data.");
      assert(stateValue.clubText.includes("2nd"), "My Clubs did not render current league position.");
      assert(stateValue.statusText === "", "My Clubs reported an unexpected load status: " + stateValue.statusText);
      assert(stateValue.lockedHidden === true, "My Clubs incorrectly rendered the guest lock screen.");
    } else if (scenario === "myclubs-out") {
      assert(stateValue.path === "/my-clubs/opted-out", "My Clubs opted-out canonical path is wrong: " + stateValue.path);
      assert(stateValue.pageHidden === true, "My Clubs private page was visible while opted out.");
      assert(stateValue.lockedHidden === false, "My Clubs opted-out shell remained hidden.");
      assert(stateValue.lockedTitle === "My Clubs", "My Clubs opted-out title is wrong.");
      assert(stateValue.lockedMessage === "In order to see your clubs, you need to opt in.", "My Clubs opted-out copy is wrong.");
    } else if (scenario === "mflstats") {
      assert(stateValue.path === "/mfl/stats", "MFL Stats canonical path is wrong: " + stateValue.path);
      assert(stateValue.total === "1", "MFL Stats total count did not render the fixture player.");
      assert(stateValue.packable === "1", "MFL Stats packable count did not classify the fixture player.");
      assert(stateValue.statsHidden === false, "MFL Stats page remained hidden after readiness.");
      assert(stateValue.distributionSkeleton === false, "MFL Stats kept its skeleton after authoritative data rendered.");
      assert(stateValue.distributionColumns > 0, "MFL Stats did not restore real histogram columns after navigation.");
    }
  }

  async function navigateBackToScenario(setPage, timeline) {
    await setPage("privacy", true);
    await waitFor(() => window.location.pathname === "/privacy", scenario + " could not navigate to Privacy.");
    const baselineSequence = timeline.snapshot().at(-1)?.sequence || 0;

    if (scenario === "database" || scenario === "database-empty") {
      await setPage("database", true, { view: "attributes" });
    } else if (scenario === "player") {
      await setPage("player", true, { playerId: "1" });
    } else if (scenario === "watchlist" || scenario === "watchlist-empty") {
      await setPage("watchlist", true, { watchlistId: testWatchlistId, view: "current" });
    } else if (scenario === "myclubs") {
      const navigation = setPage("my-clubs", true);
      await waitFor(
        () => !hidden("#myClubsPage") && document.querySelectorAll("#myClubsGrid .myClubCardLoading").length > 0,
        "My Clubs did not reveal its canonical shell and skeleton while data was pending.",
      );
      await navigation;
      await waitFor(
        () => text("#myClubsGrid").includes("2nd"),
        "My Clubs did not enrich the visible club card with current competition data.",
      );
    } else if (scenario === "myclubs-out") {
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
    if (scenario === "myclubs") {
      await waitFor(
        () => document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length === 1,
        "My Clubs direct refresh did not replace the full-card skeleton with base club content.",
      );
      await waitFor(
        () => text("#myClubsGrid").includes("2nd"),
        "My Clubs direct refresh did not enrich the base club card with competition data.",
      );
    }
    await delay(80);
    const directState = routeState();
    assertRouteState(directState);

    if (scenario.endsWith("-empty")) {
      assert(errors.length === 0, "Console/runtime errors occurred: " + errors.join(" | "));
      finish("passed", scenario + ": URL-filtered direct refresh committed the authoritative empty table state.");
      return;
    }

    await navigateBackToScenario(setPage, timeline);
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

function writeJson(response, data) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function pageDataStub(url) {
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
  const rows = filteredEmpty ? [] : [rowForColumns(pageColumns)];
  const requestedPageSize = Number(url.searchParams.get("pageSize"));
  const pageSize = scope === "mflstats"
    ? rows.length
    : (Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? Math.trunc(requestedPageSize) : 100);
  return {
    columns: pageColumns,
    rows,
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

function dataStub(url) {
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
  if (mode === "page") return pageDataStub(url);
  if (mode === "my-clubs") {
    return {
      clubs: [{
        clubId: "101",
        name: "Browser Club",
        city: "Bologna",
        nation: "Italy",
        division: 2,
        primaryColor: "#112233",
        secondaryColor: "#445566",
        logoUrl: "",
      }],
      generatedAt,
      source: "browser-regression",
    };
  }
  if (mode === "my-clubs-competitions") {
    return {
      competitionsByClub: {
        "101": [{
          competitionId: 501,
          name: "Browser League",
          type: "LEAGUE",
          seasonNumber: 16,
          standing: { position: 2 },
        }],
      },
      generatedAt,
      source: "browser-regression",
    };
  }
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
      const mode = String(url.searchParams.get("mode") || "");
      if (mode === "my-clubs") {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 180));
      } else if (mode === "my-clubs-competitions") {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 220));
      }
      writeJson(response, dataStub(url));
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

async function runChromeRegression(executable, url) {
  const debuggingPort = await reserveTcpPort();
  const userDataDirectory = await mkdtemp(join(tmpdir(), "mfl-browser-routing-"));
  const child = spawn(executable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--window-size=1280,900",
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
  ["database-empty", "/database/attributes?overall.gte=99"],
  ["player", "/players/1"],
  ["watchlist", `/watchlist/${testWatchlistId}/current-season`],
  ["watchlist-empty", `/watchlist/${testWatchlistId}/current-season?overall.gte=99`],
  ["myclubs", "/my-clubs"],
  ["myclubs-out", "/my-clubs/opted-out"],
  ["mflstats", "/mfl/stats"],
]);

const server = await createRegressionServer();
try {
  const address = server.address();
  assert(address && typeof address === "object", "Browser regression server did not expose a TCP address.");
  const executable = browserExecutable();

  for (const [scenario, path] of regressionScenarios) {
    const url = `http://127.0.0.1:${address.port}${path}`;
    const result = await runChromeRegression(executable, url);
    assert.equal(result.status, "passed");
    console.log(`Browser routing regression passed: ${scenario}: ${result.detail}`);
  }
} finally {
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
