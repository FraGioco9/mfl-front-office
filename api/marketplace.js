const { performance } = require("node:perf_hooks");
const { sendJson } = require("./_data-auth");
const { marketplaceState } = require("./_marketplace-state");

module.exports = async function handler(request, response) {
  const startedAt = performance.now();
  const timings = {};

  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." }, startedAt, timings);
    return;
  }

  try {
    const marketplaceStartedAt = performance.now();
    const marketplace = await marketplaceState();
    timings.marketplace = performance.now() - marketplaceStartedAt;
    sendJson(response, 200, {
      generatedAt: marketplace.generatedAt,
      flowBlockHeight: marketplace.flowBlockHeight,
      prices: marketplace.prices,
      source: "flow-marketplace",
    }, startedAt, timings);
  } catch (error) {
    console.error("Could not load marketplace snapshot.", error);
    sendJson(
      response,
      500,
      { error: "Could not load marketplace snapshot." },
      startedAt,
      timings,
    );
  }
};
