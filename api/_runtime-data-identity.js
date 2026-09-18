const release = require("../release.json");

function normalizeDeploymentCommit(value) {
  const commit = String(value || "").trim().toLowerCase();
  if (!commit) return "";
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error("Application deployment identity contains an invalid commit.");
  }
  return commit;
}

function readBundledDeploymentCommit() {
  try {
    return require("./_deployment-commit.generated");
  } catch (error) {
    if (
      error?.code === "MODULE_NOT_FOUND"
      && String(error?.message || "").includes("_deployment-commit.generated")
    ) {
      return "";
    }
    throw error;
  }
}

function resolveRuntimeDeploymentCommit(env = process.env) {
  const bundledCommit = normalizeDeploymentCommit(readBundledDeploymentCommit());
  const environmentCommit = normalizeDeploymentCommit(env.MFL_DEPLOY_COMMIT);

  if (bundledCommit && environmentCommit && bundledCommit !== environmentCommit) {
    throw new Error("Bundled and environment deployment identities disagree.");
  }

  return bundledCommit || environmentCommit;
}

function runtimeDataIdentity(databaseGeneratedAt, options = {}) {
  const version = String(release?.version || "").trim();
  const description = String(release?.description || "").trim();
  const generatedAt = String(databaseGeneratedAt || "").trim();
  const commit = normalizeDeploymentCommit(
    options.commit === undefined ? resolveRuntimeDeploymentCommit() : options.commit,
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
  resolveRuntimeDeploymentCommit,
  runtimeDataIdentity,
};
