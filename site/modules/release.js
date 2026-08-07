// @ts-check

/**
 * @typedef {Readonly<{version: string, description: string}>} ReleaseMetadata
 */

/** @returns {Promise<ReleaseMetadata>} */
export async function loadRelease() {
  const response = await fetch("/release.json", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Could not load release metadata (${response.status}).`);
  }

  const payload = await response.json();
  const version = typeof payload?.version === "string" ? payload.version.trim() : "";
  const description = typeof payload?.description === "string" ? payload.description.trim() : "";
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("Release metadata contains an invalid Semantic Version.");
  }

  return Object.freeze({ version, description });
}
