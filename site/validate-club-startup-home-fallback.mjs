import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const coreSource = await read("./modules/app-core.js");
const eagerCore = String(normalizeBuiltApplicationCoreArtifacts(coreSource).core || "");
const parserStart = eagerCore.indexOf("function pageTargetFromPath(path) {");
const parserEnd = eagerCore.indexOf("\n}\n\nfunction pagePath", parserStart);
const parser = eagerCore.slice(parserStart, parserEnd);

const clubResolution = parser.indexOf("const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(cleanPath);");
const clubTarget = parser.indexOf('pageName: "club",', clubResolution);
const homeFallback = parser.indexOf('pageName: ["home", "evaluation", "settings", "changelog"].includes(pageName) ? pageName : "home"');

invariant(clubResolution >= 0, "Shared startup routing must inspect canonical Club routes.");
invariant(clubTarget > clubResolution, "Canonical Club routes must resolve to the Club page.");
invariant(homeFallback > clubTarget, "The unknown-route Home fallback must run only after Club routing has been resolved.");

console.log("Club startup Home-fallback regression validation passed.");
