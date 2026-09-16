const release = require("../release.json");

function normalizeDeploymentCommit(value) {
  const commit = String(value || "").trim().toLowerCase();
  if (!commit) return "";
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error("Application deployment identity contains an invalid commit.");
  }
  return commit;
}

function runtimeDataIdentity(databaseGeneratedAt, options = {}) {
  const version = String(release?.version || "").trim();
  const description = String(release?.description || "").trim();
  const generatedAt = String(databaseGeneratedAt || "").trim();
  const commit = normalizeDeploymentCommit(
    options.commit === undefined ? process.env.MFL_DEPLOY_COMMIT : options.commit,
  );

  if (!version) {
    throw new Error("Application release identity is missing a version.");
  }
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("Database release identity is missing a valid generatedAt value.");
  }

  return {
    runtime: {
      version,
      description,
      commit: commit || null,
    },
    database: {
      generatedAt,
    },
  };
}

module.exports = {
  normalizeDeploymentCommit,
  runtimeDataIdentity,
};
