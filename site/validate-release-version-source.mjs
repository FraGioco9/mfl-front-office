import { readFile } from "node:fs/promises";

import {
  normalizeBootstrapReleaseProjection,
  normalizeIndexReleaseProjection,
} from "./sync-release-projections.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [releaseSource, buildSource, preBootstrapSource, bootstrap, bootstrapCore, indexHtml, tableWidthRuntime, siteQualityWorkflow] = await Promise.all([
  read("./release.json"),
  read("./build-app-core.mjs"),
  read("./modules/pre-bootstrap-route-state.js"),
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
  read("./table-width-runtime.js"),
  read("../.github/workflows/site-quality.yml"),
]);

const release = JSON.parse(releaseSource);
const version = String(release.version || "").trim();
invariant(/^\d+\.\d+\.\d+$/.test(version), "release.json must contain the canonical Semantic Version.");

invariant(
  bootstrap.includes(`const STATIC_RELEASE_VERSION = "${version}";`),
  "bootstrap.js must contain the generated projection of release.json.",
);
invariant(
  bootstrapCore.includes(`const STATIC_RELEASE_VERSION = String(window.__mflReleaseVersion || "${version}");`),
  "bootstrap-core.js must contain the generated fallback projection of release.json.",
);
invariant(
  indexHtml.includes(`<a href="/changelog" data-page="changelog">MFL Front Office v${version}</a>`),
  "The static footer must contain the generated projection of release.json.",
);

invariant(
  buildSource.includes('import { synchronizeReleaseProjections } from "./sync-release-projections.mjs";')
    && buildSource.includes("await synchronizeReleaseProjections(siteRoot);"),
  "The canonical build must regenerate release projections from release.json before browser artifacts.",
);
invariant(
  siteQualityWorkflow.includes("run: npm run build")
    && siteQualityWorkflow.includes("site/bootstrap.js")
    && siteQualityWorkflow.includes("site/bootstrap-core.js")
    && siteQualityWorkflow.includes("site/index.html")
    && siteQualityWorkflow.includes("site/modules/app-core-*-runtime.js")
    && siteQualityWorkflow.includes('git commit -m "Regenerate site artifacts"'),
  "Site Quality must own one ordered build-and-commit path for release projections and generated application artifacts.",
);
invariant(
  preBootstrapSource.includes("window.__mflRelease = data.release;")
    && preBootstrapSource.includes("window.__mflReleaseVersion = data.release.version;"),
  "Generated pre-bootstrap state must expose the canonical release facade sourced from release.json.",
);
invariant(
  !preBootstrapSource.includes("querySelector") && !tableWidthRuntime.includes("querySelector"),
  "Release projection must not add DOM-repair ownership to the Uniform Width pre-bootstrap runtime.",
);
invariant(
  tableWidthRuntime.includes(`"version":"${version}"`),
  "The tracked generated pre-bootstrap runtime must project the version from release.json.",
);

const fakeVersion = "8.8.8";
const normalizedBootstrap = normalizeBootstrapReleaseProjection(
  '(() => {\n  const STATIC_RELEASE_VERSION = "9.9.9";\n})();\n',
  fakeVersion,
  "bootstrap.js",
);
invariant(
  normalizedBootstrap.includes(`const STATIC_RELEASE_VERSION = "${fakeVersion}";`)
    && !normalizedBootstrap.includes('"9.9.9"'),
  "Bootstrap projection generation must replace a stale version from the canonical release input.",
);
const normalizedBootstrapCore = normalizeBootstrapReleaseProjection(
  '(() => {\n  const STATIC_RELEASE_VERSION = String(window.__mflReleaseVersion || "9.9.9");\n})();\n',
  fakeVersion,
  "bootstrap-core.js",
);
invariant(
  normalizedBootstrapCore.includes(`window.__mflReleaseVersion || "${fakeVersion}"`)
    && !normalizedBootstrapCore.includes('"9.9.9"'),
  "Bootstrap-core projection generation must replace a stale fallback from the canonical release input.",
);
const normalizedIndex = normalizeIndexReleaseProjection(
  '<footer><a href="/changelog" data-page="changelog">MFL Front Office v9.9.9</a></footer>',
  fakeVersion,
);
invariant(
  normalizedIndex.includes(`>MFL Front Office v${fakeVersion}</a>`) && !normalizedIndex.includes("9.9.9"),
  "Footer projection generation must replace a stale version from the canonical release input.",
);

console.log(`Single release source validation passed for v${version}: release.json owns the version and Site Quality persists every generated projection/artifact in one ordered path.`);
