import { readFile } from "node:fs/promises";

import {
  normalizeBootstrapReleaseProjection,
  normalizeIndexReleaseProjection,
} from "./sync-release-projections.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [releaseSource, buildSource, preBootstrapSource, bootstrap, bootstrapCore, indexHtml, tableWidthRuntime] = await Promise.all([
  read("./release.json"),
  read("./build-app-core.mjs"),
  read("./modules/pre-bootstrap-route-state.js"),
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
  read("./table-width-runtime.js"),
]);

const release = JSON.parse(releaseSource);
const version = String(release.version || "").trim();
invariant(/^\d+\.\d+\.\d+$/.test(version), "release.json must contain the canonical Semantic Version.");

const canonicalExpression = 'String(Reflect.get(window, "__mflAppConfig")?.release?.version || Reflect.get(window, "__mflReleaseVersion") || "dev")';
invariant(
  bootstrap.includes(`const STATIC_RELEASE_VERSION = ${canonicalExpression};`),
  "bootstrap.js must resolve the current version from generated pre-bootstrap release metadata.",
);
invariant(
  bootstrapCore.includes(`const STATIC_RELEASE_VERSION = ${canonicalExpression};`),
  "bootstrap-core.js must resolve the current version from generated pre-bootstrap release metadata.",
);
invariant(
  !bootstrap.includes(`const STATIC_RELEASE_VERSION = "${version}";`),
  "bootstrap.js must not duplicate the current release version.",
);
invariant(
  !bootstrapCore.includes(`window.__mflReleaseVersion || "${version}"`),
  "bootstrap-core.js must not duplicate the current release version.",
);
invariant(
  indexHtml.includes('<a href="/changelog" data-page="changelog">MFL Front Office</a>'),
  "The static footer must remain version-neutral before generated pre-bootstrap metadata runs.",
);
invariant(
  !indexHtml.includes(`MFL Front Office v${version}</a>`),
  "index.html must not duplicate the current release version.",
);

invariant(
  buildSource.includes('import { synchronizeReleaseProjections } from "./sync-release-projections.mjs";')
    && buildSource.includes("await synchronizeReleaseProjections(siteRoot);"),
  "The canonical build must normalize release projections before generating browser artifacts.",
);
invariant(
  preBootstrapSource.includes("window.__mflRelease = data.release;")
    && preBootstrapSource.includes("window.__mflReleaseVersion = data.release.version;")
    && preBootstrapSource.includes("releaseFooter.textContent = `MFL Front Office v${data.release.version}`;"),
  "Generated pre-bootstrap state must own the browser release facade and first-paint footer version.",
);
invariant(
  tableWidthRuntime.includes(`"version":"${version}"`),
  "The tracked generated pre-bootstrap runtime must project the version from release.json.",
);

const normalizedBootstrap = normalizeBootstrapReleaseProjection(
  '(() => {\n  const STATIC_RELEASE_VERSION = "9.9.9";\n})();\n',
  "test bootstrap",
);
invariant(
  normalizedBootstrap.includes(`const STATIC_RELEASE_VERSION = ${canonicalExpression};`)
    && !normalizedBootstrap.includes('"9.9.9"'),
  "Bootstrap projection normalization must remove an independently owned version literal.",
);
const normalizedIndex = normalizeIndexReleaseProjection(
  '<footer><a href="/changelog" data-page="changelog">MFL Front Office v9.9.9</a></footer>',
);
invariant(
  normalizedIndex.includes('>MFL Front Office</a>') && !normalizedIndex.includes("9.9.9"),
  "Footer projection normalization must remove an independently owned version literal.",
);

console.log(`Single release source validation passed for v${version}: release.json is the only human-owned current-version source.`);
