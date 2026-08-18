(() => {
  "use strict";

  const UNIFORM_WIDTH_NAME = "Uniform Width";

  const GROUP_VARIABLES = Object.freeze({
    player: Object.freeze([
      Object.freeze(["overall", "--mfl-table-col-overall"]),
      Object.freeze(["selection", "--mfl-table-col-select"]),
      Object.freeze(["id", "--mfl-table-col-id"]),
      Object.freeze(["flag", "--mfl-table-col-flag"]),
      Object.freeze(["name", "--mfl-table-col-name"]),
      Object.freeze(["nationality", "--mfl-table-col-nationality"]),
      Object.freeze(["age", "--mfl-table-col-age"]),
      Object.freeze(["positions", "--mfl-table-col-positions"]),
      Object.freeze(["seasons", "--mfl-table-col-seasons"]),
      Object.freeze(["stat", "--mfl-table-col-stat"]),
      Object.freeze(["contractRevenue", "--mfl-table-col-contract-revenue"]),
      Object.freeze(["contractClub", "--mfl-table-col-contract-club"]),
      Object.freeze(["contractDivision", "--mfl-table-col-contract-division"]),
      Object.freeze(["agent", "--mfl-table-col-agent"]),
      Object.freeze(["joinedAgency", "--mfl-table-col-joined-agency"]),
      Object.freeze(["ownedSince", "--mfl-table-col-owned-since"]),
      Object.freeze(["link", "--mfl-table-col-link"]),
    ]),
    evaluationSummary: Object.freeze([
      Object.freeze(["name", "--mfl-evaluation-summary-col-name"]),
      Object.freeze(["position", "--mfl-evaluation-summary-col-position"]),
      Object.freeze(["age", "--mfl-evaluation-summary-col-age"]),
      Object.freeze(["overall", "--mfl-evaluation-summary-col-overall"]),
      Object.freeze(["seasons", "--mfl-evaluation-summary-col-seasons"]),
      Object.freeze(["return", "--mfl-evaluation-summary-col-return"]),
      Object.freeze(["value", "--mfl-evaluation-summary-col-value"]),
    ]),
    evaluationSeason: Object.freeze([
      Object.freeze(["name", "--mfl-evaluation-season-col-name"]),
      Object.freeze(["season", "--mfl-evaluation-season-col-season"]),
      Object.freeze(["age", "--mfl-evaluation-season-col-age"]),
      Object.freeze(["overall", "--mfl-evaluation-season-col-overall"]),
      Object.freeze(["mfl", "--mfl-evaluation-season-col-mfl"]),
      Object.freeze(["usd", "--mfl-evaluation-season-col-usd"]),
      Object.freeze(["discount", "--mfl-evaluation-season-col-discount"]),
      Object.freeze(["value", "--mfl-evaluation-season-col-value"]),
    ]),
    advancedContracts: Object.freeze([
      Object.freeze(["label", "--mfl-advanced-player-col-label"]),
      Object.freeze(["value", "--mfl-advanced-player-col-value"]),
    ]),
  });

  function percentageVariable(style, variableName) {
    const raw = String(style.getPropertyValue(variableName) || "").trim();
    if (!raw.endsWith("%")) {
      throw new Error(`${UNIFORM_WIDTH_NAME} value ${variableName} must be a percentage.`);
    }
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${UNIFORM_WIDTH_NAME} value ${variableName} is invalid.`);
    }
    return value;
  }

  function readGroup(style, entries) {
    return Object.freeze(Object.fromEntries(entries.map(([key, variableName]) => [
      key,
      percentageVariable(style, variableName),
    ])));
  }

  function total(values) {
    return Object.values(values).reduce((sum, value) => sum + Number(value), 0);
  }

  function closeTo(left, right, tolerance = 0.0001) {
    return Math.abs(Number(left) - Number(right)) <= tolerance;
  }

  const style = window.getComputedStyle(document.documentElement);
  const groups = Object.freeze(Object.fromEntries(Object.entries(GROUP_VARIABLES).map(([groupName, entries]) => [
    groupName,
    readGroup(style, entries),
  ])));

  const player = groups.player;
  const playerShared = player.selection
    + player.id
    + player.flag
    + player.name
    + player.nationality
    + player.age
    + player.positions
    + player.seasons
    + player.overall
    + player.agent
    + player.link;
  const statsTotal = playerShared + (player.stat * 6);
  const contractsTotal = playerShared + player.contractRevenue + player.contractClub + player.contractDivision;

  if (!closeTo(statsTotal, 100)
    || !closeTo(contractsTotal, 100)
    || !closeTo(player.joinedAgency, player.agent)
    || !closeTo(player.ownedSince, player.agent)
    || !closeTo(total(groups.evaluationSummary), 100)
    || !closeTo(total(groups.evaluationSeason), 100)
    || !closeTo(groups.advancedContracts.label + (groups.advancedContracts.value * 15), 100)) {
    throw new Error(`${UNIFORM_WIDTH_NAME} percentage contract is invalid.`);
  }

  const contract = Object.freeze({
    name: UNIFORM_WIDTH_NAME,
    source: "styles.css",
    unit: "%",
    groups,
  });

  /* Compatibility only. Widths are CSS-owned and are never applied by JS.
   * Existing callers may request a sync while old route code is phased out;
   * this intentionally performs no DOM mutation. */
  const apply = () => true;
  const destroy = () => {};

  window.__mflTableWidthRuntime?.destroy?.();
  window.__mflUniformWidth = contract;
  window.__mflTableWidthConfig = contract;
  window.__mflTableWidthRuntime = Object.freeze({
    canonical: true,
    name: UNIFORM_WIDTH_NAME,
    config: contract,
    apply,
    takeOwnership: apply,
    destroy,
  });
})();
