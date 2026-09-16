const { getGeneratedAt } = require("./_database");
const { loadOperationalHealth } = require("./_operational-health");

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");

  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    response.status(200).json(await loadOperationalHealth(getGeneratedAt()));
  } catch (error) {
    console.error("Could not resolve operational health.", error);
    response.status(500).json({ error: "Could not resolve operational health." });
  }
};
