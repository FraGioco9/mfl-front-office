const release = require("../release.json");

function runtimeDataIdentity(databaseGeneratedAt) {
  const version = String(release?.version || "").trim();
  const description = String(release?.description || "").trim();
  const generatedAt = String(databaseGeneratedAt || "").trim();

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
    },
    database: {
      generatedAt,
    },
  };
}

module.exports = {
  runtimeDataIdentity,
};
