import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const release = JSON.parse(await read("./release.json"));
const sandbox = {
  window: {},
  location: { pathname: "/", search: "", hash: "" },
  history: { replaceState() {} },
  console,
};
vm.runInNewContext(browserConfigRuntimeSource(release), sandbox);
const routes = sandbox.window.__mflAppConfig?.routes;
assert.ok(routes, "Canonical route config must be available.");

assert.equal(routes.normalizePageName("my-clubs"), "myclubs", "My Clubs slug must normalize to the route page name.");
const canonical = routes.canonicalRequest("/my-clubs");
assert.equal(canonical.pageName, "myclubs", "/my-clubs must resolve to My Clubs.");
assert.equal(canonical.canonicalPath, "/my-clubs", "My Clubs must keep its canonical hyphenated path.");
const alias = routes.canonicalRequest("/myclubs");
assert.equal(alias.pageName, "myclubs", "/myclubs must resolve to My Clubs.");
assert.equal(alias.options.replaceUrl, "/my-clubs", "Legacy unhyphenated My Clubs URLs must canonicalize.");
const dependencies = routes.routeDependencyPlan("myclubs");
assert.deepEqual([...dependencies.core], ["myclubs"], "My Clubs must load only its lightweight route core.");
assert.equal(dependencies.table, false, "My Clubs must not load player-table infrastructure.");
assert.equal(routes.corePaths.myclubs, "/modules/app-core-my-clubs-runtime.js", "My Clubs must own a generated route core.");

const manifest = coreSourceByDomain.myclubs;
assert.ok(manifest, "Core source manifest must register My Clubs.");
assert.equal(manifest.source, "my-clubs.js");
assert.equal(manifest.runtime, "app-core-my-clubs-runtime.js");

const [pageHtml, accessHtml, chromeHtml, htmlManifest, coreSource, dataApi, clubsApi] = await Promise.all([
  read("./html-sources/my-clubs.html"),
  read("./html-sources/access.html"),
  read("./html-sources/chrome.html"),
  read("./html-sources/manifest.json"),
  read("./modules/core-sources/my-clubs.js"),
  read("./api/data.js"),
  read("./api/_clubs.js"),
]);

assert.match(pageHtml, /id="myClubsPage"/u, "My Clubs must expose a dedicated page shell.");
assert.match(pageHtml, /id="myClubsGrid"/u, "My Clubs must expose a card grid.");
assert.match(pageHtml, /class="myClubCard"|\.myClubCard/u, "My Clubs must own club-card styling.");
assert.doesNotMatch(pageHtml, /!important/u, "My Clubs styles must not use overrides.");
assert.match(accessHtml, /myclubs: \["My Clubs", "In order to see your clubs, you need to opt in\."\]/u, "My Clubs must use the shared opt-in locked shell.");
assert.match(chromeHtml, /href="\/my-clubs" data-page="myclubs"/u, "My Clubs must be first-class sidebar navigation.");
const fragmentOrder = JSON.parse(htmlManifest);
assert.ok(fragmentOrder.includes("my-clubs.html"), "My Clubs HTML fragment must be assembled into the site.");
assert.ok(fragmentOrder.indexOf("my-clubs.html") < fragmentOrder.indexOf("access.html"), "My Clubs first-paint state must be available before locked-copy hydration.");

new Function(coreSource);
assert.match(coreSource, /fetch\("\/api\/data\?mode=my-clubs"/u, "My Clubs must fetch the signed canonical data endpoint.");
assert.match(coreSource, /cacheWallet && cacheWallet !== wallet/u, "My Clubs cache must invalidate on wallet changes.");
assert.match(coreSource, /clearCache\(\);\n\s*void renderRoute\(false/u, "Opt-out must clear old clubs immediately.");
assert.match(coreSource, /No clubs found for this wallet\./u, "My Clubs must define an empty state.");
assert.match(coreSource, /`\/clubs\/\$\{encodeURIComponent\(clubId\)\}\/squad`/u, "Club cards must link through the canonical Club Squad route.");
assert.match(dataApi, /mode === "my-clubs"/u, "The database API must expose My Clubs mode.");
assert.match(clubsApi, /https:\/\/api\.playmfl\.com\/u\/clubs/u, "Club logos must use the canonical PlayMFL host.");

console.log("My Clubs route validation passed.");
