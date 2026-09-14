const { createHash } = require("node:crypto");

function snapshotEtag(...identityParts) {
  const identity = identityParts.map((part) => String(part ?? "")).join("\n");
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 24);
  return `"mfl-${digest}"`;
}

function requestMatchesEtag(request, etag) {
  const value = String(request?.headers?.["if-none-match"] || "");
  return value.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === etag || normalized === `W/${etag}`;
  });
}

module.exports = {
  snapshotEtag,
  requestMatchesEtag,
};
