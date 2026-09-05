import { access } from "node:fs/promises";

import {
  normalizeBootstrapReleaseProjection,
  normalizeIndexReleaseProjection,
} from "./sync-release-projections.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [releaseSource, buildSource, preBootstrapSource, bootstrap, bootstrapCore, indexHtml, tableWidthRuntime, siteQualityWorkflow, cleanupWorkflow, releaseProjectionWorkflowExists] = await Promise.all([
  read("./release.json"),
  read("./build-app-core.mjs"),
  read("./modules/pre-bootstrap-route-state.js"),
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
  read("./table-width-runtime.js"),
  read("../.github/workflows/site-quality.yml"),
  read("../.github/workflows/cleanup-unused-branches.yml"),
  access(new URL("../.github/workflows/release-projection-sync.yml", import.meta.url)).then(() => true, () => false),
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
  indexHtml.includes(`<a id="siteFooterDetailsTitle" class="siteFooterDetailsTitle" href="/changelog" data-page="changelog">MFL Front Office v${version}</a>`),
  "The static footer title must contain the generated projection of release.json.",
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
    && siteQualityWorkflow.includes("site/vercel.production.json")
    && siteQualityWorkflow.includes("site/styles-runtime.css")
    && siteQualityWorkflow.includes("site/modules/app-core-*-runtime.js")
    && siteQualityWorkflow.includes('git commit -m "Regenerate site artifacts"'),
  "Site Quality must own one ordered build-and-commit path for release projections and generated site artifacts.",
);
invariant(
  siteQualityWorkflow.includes("checks: write")
    && siteQualityWorkflow.includes("Publish exact generated-head quality check")
    && siteQualityWorkflow.includes('name: "quality"')
    && siteQualityWorkflow.includes('conclusion: "success"'),
  "Site Quality must publish an explicit successful quality check on the exact bot-generated PR head after verification.",
);
invariant(
  !releaseProjectionWorkflowExists,
  "The retired Release projection sync workflow must stay deleted so no second workflow can race Site Quality writes.",
);
invariant(
  cleanupWorkflow.includes("- site/release.json")
    && cleanupWorkflow.includes("branches:\n      - main")
    && cleanupWorkflow.includes('gh api --paginate "repos/${GITHUB_REPOSITORY}/pulls?state=open&per_page=100"'),
  "Release metadata changes on main must automatically trigger open-PR-safe unused-branch cleanup.",
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
  '<footer><a id="siteFooterDetailsTitle" class="siteFooterDetailsTitle" href="/changelog" data-page="changelog">MFL Front Office v9.9.9</a></footer>',
  fakeVersion,
);
invariant(
  normalizedIndex.includes(`>MFL Front Office v${fakeVersion}</a>`) && !normalizedIndex.includes("9.9.9"),
  "Footer title projection generation must replace a stale version from the canonical release input.",
);

console.log(`Single release source validation passed for v${version}: Site Quality is the sole generated-artifact writer and exact generated heads receive a verified quality check.`);
