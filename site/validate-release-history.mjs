import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

function versionParts(value) {
  const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  invariant(a && b, `Invalid release comparison: ${left} / ${right}.`);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function addHistoryEntries(target, entries, sourceLabel) {
  invariant(Array.isArray(entries), `${sourceLabel} must contain an array.`);
  for (const entry of entries) {
    invariant(Array.isArray(entry) && entry.length === 2, `${sourceLabel} contains an invalid release entry.`);
    const [version, description] = entry;
    invariant(versionParts(version), `${sourceLabel} contains invalid version ${String(version)}.`);
    invariant(String(description || "").trim().length > 10, `${version} must have a useful release description.`);
    if (!target.has(version)) target.set(version, String(description));
  }
}

const [releaseSource, bootstrap, bootstrapCore, indexHtml, overridesSource, historySource, releasesApi] = await Promise.all([
  read("./release.json"),
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
  read("./release-history-overrides.json"),
  read("./api/_data/releases-history.json"),
  read("./api/releases.js"),
]);

const release = JSON.parse(releaseSource);
const currentVersion = String(release.version || "").trim();
const currentParts = versionParts(currentVersion);
invariant(currentParts, "release.json must contain a Semantic Version.");

const bootstrapVersion = bootstrap.match(/const\s+STATIC_RELEASE_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']/)?.[1] || "";
const bootstrapCoreVersion = bootstrapCore.match(/window\.__mflReleaseVersion\s*\|\|\s*["'](\d+\.\d+\.\d+)["']/)?.[1] || "";
invariant(bootstrapVersion === currentVersion, `bootstrap.js generated projection ${bootstrapVersion || "<missing>"} must match release.json ${currentVersion}.`);
invariant(bootstrapCoreVersion === currentVersion, `bootstrap-core.js generated fallback ${bootstrapCoreVersion || "<missing>"} must match release.json ${currentVersion}.`);
invariant(
  bootstrap.includes("footerVersion.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`"),
  "bootstrap.js must synchronously render the generated current release version in the footer.",
);
invariant(
  bootstrapCore.includes("footer.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`"),
  "bootstrap-core.js must preserve the generated current release version in the footer.",
);
invariant(
  indexHtml.includes(`<a id="siteFooterDetailsTitle" class="siteFooterDetailsTitle" href="/changelog" data-page="changelog">MFL Front Office v${currentVersion}</a>`),
  "index.html must contain the generated current release footer-title projection.",
);

const overrides = JSON.parse(overridesSource);
const history = JSON.parse(historySource);
const mergedHistory = new Map([[`v${currentVersion}`, String(release.description || "")]]);
addHistoryEntries(mergedHistory, overrides, "release-history-overrides.json");
addHistoryEntries(mergedHistory, history, "api/_data/releases-history.json");

for (const version of mergedHistory.keys()) {
  invariant(
    compareVersions(version, currentVersion) <= 0,
    `${version} is newer than current release v${currentVersion}; release.json must remain the newest version.`,
  );
}

const [major, minor, patch] = currentParts;
for (let currentPatch = 0; currentPatch <= patch; currentPatch += 1) {
  const requiredVersion = `v${major}.${minor}.${currentPatch}`;
  invariant(
    mergedHistory.has(requiredVersion),
    `Changelog history is missing ${requiredVersion}. Add every released patch before advancing ${major}.${minor}.x.`,
  );
}

invariant(
  releasesApi.includes("const merged = new Map([[currentLabel, release.description]])"),
  "The releases API must put release.json first so Changelog always starts from the newest version.",
);
invariant(
  releasesApi.includes("[...historyOverrides, ...history].forEach"),
  "The releases API must merge the complete override and archived histories after the current release.",
);

console.log(`Release/footer history validation passed for v${currentVersion} with generated projections and complete ${major}.${minor}.0-${patch} coverage.`);
