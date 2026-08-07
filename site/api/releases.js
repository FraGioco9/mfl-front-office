const release = require("../release.json");
const history = require("./_data/releases-history.json");

module.exports = function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const currentLabel = `v${release.version}`;
  const releases = [
    [currentLabel, release.description],
    ...history.filter((entry) => Array.isArray(entry) && entry[0] !== currentLabel),
  ];
  response.status(200).json(releases);
};
