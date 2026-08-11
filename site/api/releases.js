const release = require("../release.json");
const rewrittenHistory = require("../releases-rewritten.json");
const history = require("./_data/releases-history.json");

module.exports = function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const currentLabel = `v${release.version}`;
  const merged = new Map([[currentLabel, release.description]]);

  [...rewrittenHistory, ...history].forEach((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) return;
    const [version, description] = entry;
    if (merged.has(version)) return;
    merged.set(version, description);
  });

  response.status(200).json(Array.from(merged.entries()));
};
