import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreArtifacts, readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const source = await Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n"));
const artifacts = readCanonicalCoreArtifacts(source);
const generatedSources = [artifacts.core, ...Object.values(artifacts.routeChunks || {})].map((value) => String(value || ""));
const generated = generatedSources.join("\n");

invariant(
  !generated.includes('const VERSION = "1.122.0";'),
  "Generated application-core artifacts must not retain the legacy v1.122.0 VERSION owner.",
);
invariant(
  !generated.includes('const RELEASE_VERSION = "1.122.0";'),
  "Generated application-core artifacts must not retain the legacy v1.122.0 release marker.",
);
invariant(
  !generated.includes('window.__mflReleaseVersion || "1.122.0"'),
  "Generated application-core artifacts must not fall back to the legacy v1.122.0 release.",
);
invariant(
  !generated.includes('footerLink.textContent = `MFL Front Office v${VERSION}`'),
  "Generated application core must not overwrite the footer independently of static route chrome.",
);
invariant(
  generated.includes("window.__mflStaticUiRuntime?.sync?.();"),
  "Legacy release UI hooks must delegate to the shared static route chrome owner.",
);

console.log("Generated release ownership validation passed without legacy v1.122.0 runtime state.");
