import { includes, excludes, invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const [config, lifecycle, routeCore, routing, session, wallet, html, access, styles, api, backend] = await Promise.all([
  read("./modules/app-config.js"),
  read("./modules/core-sources/shared-page-lifecycle.js"),
  read("./modules/core-sources/my-clubs.js"),
  read("./modules/core-sources/shared-routing.js"),
  read("./modules/core-sources/shared-session.js"),
  read("./modules/core-sources/wallet.js"),
  read("./html-sources/my-clubs.html"),
  read("./html-sources/access.html"),
  read("./my-clubs.css"),
  read("./api/data.js"),
  read("./api/_my-clubs.js"),
]);

includes(config, '"my-clubs": "/my-clubs/opted-out"', "My Clubs must own a canonical protected opted-out route.");
includes(config, '"my-clubs": "myClubsPage"', "My Clubs must own a registered route shell.");
includes(config, '"my-clubs": "/modules/app-core-my-clubs-runtime.js"', "My Clubs must lazy-load one dedicated route core.");
includes(lifecycle, 'const myClubsPageActive = pageName === "my-clubs";', "Shared page lifecycle must classify My Clubs.");
includes(lifecycle, 'if (myClubsRoutePage) myClubsRoutePage.hidden = !myClubsPageActive;', "Shared page lifecycle must own My Clubs visibility through a local HTMLElement.");
includes(lifecycle, 'Reflect.get(window, "__mflRenderMyClubsPageOwner")', "Shared lifecycle must delegate only content rendering to My Clubs.");

includes(lifecycle, 'const myClubsRouteEntry = Boolean(options.__mflNavigationTransition);', "Every SPA entry into My Clubs must be treated as a fresh loading transition.");
includes(lifecycle, 'force: options.force === true || myClubsRouteEntry', "Warm My Clubs cache must not bypass loading when visiting the page.");
includes(html, 'class="myClubLogo myClubLoadingLogo"', "My Clubs first-paint skeleton must share the discarded PR logo geometry.");
for (const token of [
  "grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));",
  "grid-template-columns: 128px minmax(0, 1fr);",
  "min-height: 156px;",
  "max-width: 100px;",
  "padding: 16px 18px;",
  "font-size: 20px;",
]) includes(styles, token, `My Clubs must retain discarded PR card geometry: ${token}`);

for (const forbidden of [
  'document.querySelectorAll("main > .pageView")',
  "history.pushState",
  "history.replaceState",
  "state.currentPage = PAGE",
  "document.body.dataset.page =",
]) excludes(routeCore, forbidden, `My Clubs route core must not own route/shell state via ${forbidden}.`);

includes(routeCore, "renderSkeletons(wallet);", "My Clubs must render skeleton cards before its private request.");
includes(routeCore, "Math.max(1, storedCount(wallet))", "My Clubs must show at least one skeleton even on the first visit.");
includes(routeCore, 'privateResponse("/api/data?mode=my-clubs"', "My Clubs must load base club identity through the canonical private data client.");
includes(routeCore, 'mode: "my-clubs-competitions"', "My Clubs must enrich current competition data in a second request.");
includes(routeCore, "enrichCompetitions(wallet, clubs);", "Competition enrichment must start only after base club cards are committed.");
includes(routeCore, "CLUB_REQUEST_TIMEOUT_MS", "Base My Clubs loading must have a finite timeout instead of leaving a permanent skeleton.");
includes(routeCore, "COMPETITION_REQUEST_TIMEOUT_MS", "Competition enrichment must have a finite timeout without blocking base club cards.");
includes(routeCore, "...walletProofHeaders(true)", "My Clubs private data must use the signed wallet proof.");
includes(routeCore, 'setStatus(valid.length ? "" : "No clubs found for this wallet.");', "My Clubs must expose an explicit empty state.");
includes(routeCore, 'Reflect.get(window, "mflOpenClubPage")', "My Clubs cards must reuse canonical Club navigation.");
includes(routeCore, "competition?.standing?.position", "My Clubs cards must render League position.");
includes(routeCore, "competition?.stage", "My Clubs cards must render Cup stage/result.");
includes(routing, 'if (cleanPath === "/my-clubs" || cleanPath === "/myclubs")', "Shared routing must classify both My Clubs route spellings.");
includes(session, '["myplayers", "my-clubs", "watchlist", "settings"]', "Wallet opt-out must treat My Clubs as protected.");
includes(wallet, '["myplayers", "my-clubs", "watchlist", "settings"]', "Wallet opt-in must restore My Clubs protected intent.");
includes(html, 'id="myClubsPage"', "My Clubs must have a static route shell.");
includes(html, 'class="myClubCard myClubCardLoading"', "My Clubs first paint must include a static card skeleton.");
includes(access, '"my-clubs": ["My Clubs", "In order to see your clubs, you need to opt in."]', "My Clubs must own protected first-paint copy.");
for (const token of ['[data-medal="gold"]', '[data-medal="silver"]', '[data-medal="bronze"]']) {
  includes(styles, token, `My Clubs must style ${token} competition achievements.`);
}
includes(api, 'if (mode === "my-clubs" || mode === "my-clubs-competitions") return true;', "Both My Clubs API phases must require a signed wallet.");
includes(api, 'else if (mode === "my-clubs") data = myClubsData(signedWallet);', "My Clubs base API mode must dispatch to its read model.");
includes(api, 'else if (mode === "my-clubs-competitions") data = myClubsCompetitionsData(signedWallet, query.clubIds);', "My Clubs competition enrichment must dispatch separately from base card loading.");
includes(backend, "WHERE lower(owner_wallet_address) = ?", "My Clubs ownership must come from canonical runtime club ownership.");
includes(backend, "ownedClubRows(wallet, requested)", "Competition enrichment must re-check requested club IDs against the signed wallet.");
includes(backend, "calculatedLeagueStanding", "My Clubs must retain match-derived standings fallback.");
includes(backend, "cupFinalResult", "My Clubs must resolve completed cup finals.");
includes(backend, "root_competition_id", "My Clubs competition fallback must understand root competition IDs.");
includes(backend, "s.club_id IS NOT NULL", "Root-derived League candidates must require actual club participation.");
invariant(html.indexOf("myClubCardLoading") < html.indexOf("myClubsStatus"), "My Clubs skeleton must exist before status/error content.");

console.log("My Clubs validation passed.");
