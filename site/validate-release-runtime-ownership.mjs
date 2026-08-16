import { readFile } from "node:fs/promises";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const source = await read("./modules/app-core.js");
const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
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
