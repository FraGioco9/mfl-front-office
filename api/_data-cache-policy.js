const { marketplaceRequiredForPage } = require("./_data-page");

function parsedRules(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pageRequestEmbedsMarketplace(query = {}) {
  const scope = String(query.scope || "database").toLowerCase();
  const sortKey = String(query.sortKey || (scope === "club" ? "positions" : "overall"));
  return marketplaceRequiredForPage(scope, sortKey, parsedRules(query.filters));
}

function publicPageSnapshotEligible({
  query = {},
  requiresWallet = false,
} = {}) {
  if (requiresWallet) return false;
  return !pageRequestEmbedsMarketplace(query);
}

module.exports = {
  pageRequestEmbedsMarketplace,
  publicPageSnapshotEligible,
};
