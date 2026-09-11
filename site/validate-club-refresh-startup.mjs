import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { readCanonicalCoreArtifacts, readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const coreSource = await Promise.all([
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
const artifacts = readCanonicalCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");

const parserStart = eagerCore.indexOf("function pageTargetFromPath(path) {");
const parserEnd = eagerCore.indexOf("\n}\n\nfunction pagePath", parserStart);
invariant(parserStart >= 0 && parserEnd > parserStart, "Missing shared route parser.");
const parserSource = eagerCore.slice(parserStart, parserEnd + 2);

const clubRoute = (pathname) => {
  const path = String(pathname || "/").replace(/\/+$/, "") || "/";
  const match = path.match(/^\/clubs\/([^/]+)\/(info|squad|contracts|current-season|all-time)$/i);
  if (!match) return null;
  const views = {
    info: "attributes",
    squad: "attributes",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  };
  const clubId = decodeURIComponent(match[1]);
  const view = views[String(match[2]).toLowerCase()];
  const slug = String(match[2]).toLowerCase() === "info" ? "squad" : String(match[2]).toLowerCase();
  return { clubId, view, path: `/clubs/${encodeURIComponent(clubId)}/${slug}` };
};

const window = { __mflAppConfig: { routes: { clubRoute } } };
const hasWalletOptIn = () => true;
const normalizeViewForPage = (view) => view || "attributes";
const viewFromSlug = (slug) => ({ attributes: "attributes" })[slug] || "";
const normalizedPageName = (page) => page;
const mflWalletAddress = "0xff8d2bbed8164db0";
const normalizeWalletAddress = (value) => String(value || "");
const watchlistTargetFromUrl = () => ({ watchlistId: "", view: "" });
const optedOutPageFromPath = () => "";
const defaultProtectedRoutePath = () => "";

const pageTargetFromPath = new Function(
  "window",
  "hasWalletOptIn",
  "normalizeViewForPage",
  "viewFromSlug",
  "normalizedPageName",
  "mflWalletAddress",
  "normalizeWalletAddress",
  "watchlistTargetFromUrl",
  "optedOutPageFromPath",
  "defaultProtectedRoutePath",
  `${parserSource}; return pageTargetFromPath;`,
)(
  window,
  hasWalletOptIn,
  normalizeViewForPage,
  viewFromSlug,
  normalizedPageName,
  mflWalletAddress,
  normalizeWalletAddress,
  watchlistTargetFromUrl,
  optedOutPageFromPath,
  defaultProtectedRoutePath,
);

const info = pageTargetFromPath("/clubs/12345/info");
invariant(info?.pageName === "club", "Legacy Club Info refresh must resolve as Club, not Home.");
invariant(info?.options?.clubId === "12345", "Legacy Club Info refresh must preserve the Club ID.");
invariant(info?.options?.view === "attributes", "Legacy Club Info refresh must redirect to Squad.");
invariant(info?.options?.path === "/clubs/12345/squad", "Legacy Club Info refresh must carry the canonical Squad path.");

const squad = pageTargetFromPath("/clubs/12345/squad");
invariant(squad?.pageName === "club", "Club Squad refresh must resolve as Club, not Home.");
invariant(squad?.options?.clubId === "12345", "Club Squad refresh must preserve the Club ID.");
invariant(squad?.options?.view === "attributes", "Club Squad refresh must resolve Squad to attributes.");

const contracts = pageTargetFromPath("/clubs/club%20id/contracts");
invariant(contracts?.pageName === "club", "Club Contracts refresh must resolve as Club.");
invariant(contracts?.options?.clubId === "club id", "Encoded Club IDs must be decoded by canonical routing.");
invariant(contracts?.options?.view === "contracts", "Club Contracts refresh must preserve the Contracts view.");

console.log("Club refresh startup route validation passed for legacy Info redirects plus direct Squad and Contracts URLs.");
