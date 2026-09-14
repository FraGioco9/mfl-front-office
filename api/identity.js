const { performance } = require("node:perf_hooks");
const {
  PUBLIC_REVALIDATE_CACHE_CONTROL,
  sendJson,
  sendNotModified,
} = require("./_data-auth");
const { getGeneratedAt } = require("./_database");
const { snapshotEtag, requestMatchesEtag } = require("./_http-cache");
const { runtimeDataIdentity } = require("./_runtime-data-identity");

module.exports = async function handler(request, response) {
  const startedAt = performance.now();
  const timings = {};

  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." }, startedAt, timings);
    return;
  }

  try {
    const identity = runtimeDataIdentity(getGeneratedAt());
    const etag = snapshotEtag(
      identity.runtime.version,
      identity.runtime.description,
      identity.database.generatedAt,
    );
    const cacheOptions = {
      cacheControl: PUBLIC_REVALIDATE_CACHE_CONTROL,
      etag,
    };

    if (requestMatchesEtag(request, etag)) {
      sendNotModified(response, startedAt, timings, cacheOptions);
      return;
    }

    sendJson(response, 200, identity, startedAt, timings, cacheOptions);
  } catch (error) {
    console.error("Could not resolve runtime/data identity.", error);
    sendJson(
      response,
      500,
      { error: "Could not resolve runtime/data identity." },
      startedAt,
      timings,
    );
  }
};
