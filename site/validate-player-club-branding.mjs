import { includes, excludes, invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const [api, player, playerHtml, bootstrap, styles, responsive, generatedPlayer, index] = await Promise.all([
  read("./api/_data-page.js"),
  read("./modules/core-sources/player.js"),
  read("./html-sources/player.html"),
  read("./bootstrap.js"),
  read("./styles-base.css"),
  read("./responsive-sources/chrome-tablet.css.inc"),
  read("./modules/app-core-player-runtime.js"),
  read("./index.html"),
]);

includes(api, 'const playerClubId = scope === "player" && rows.length', "Player payload must derive the active Club from the authoritative Player row.");
includes(api, 'const playerClub = playerClubId ? clubProfileData(playerClubId) : null;', "Player payload must reuse canonical Club profile ownership.");
includes(api, '...(scope === "player" ? { playerClub } : {}),', "Player payload must deliver Club branding in the same request.");

for (const token of [
  'const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";',
  'function normalizePlayerClubBrand(value, expectedClubId = "") {',
  "function cachedPlayerClubBrand(clubIdValue) {",
  "function syncPlayerClubBrand(identity, contextValue) {",
  "clubKnown: true,",
  "club: clubId ? normalizePlayerClubBrand(payload.playerClub, clubId) : null,",
  'window.mflOpenClubPage(clubId, "attributes");',
  'window.__mflPlayerFirstPaintRuntime?.clubBrandingSignature?.(key) || "",',
]) includes(player, token, `Canonical Player branding is missing ${token}`);

excludes(player, 'fetch("/api/', "Player Club branding must not introduce a second client fetch path.");
includes(playerHtml, '<a class="playerClubBrand" tabindex="-1" aria-hidden="true"><img class="playerClubLogo"', "Static Player shell must reserve Club-logo geometry.");
includes(playerHtml, 'localStorage.getItem("mfl-club-display-data-v1")', "Static first paint must reuse canonical cached Club branding.");
includes(playerHtml, "if (firstPaintContext?.clubKnown === true)", "Authoritative no-Club state must beat older cached branding.");
includes(bootstrap, '<a class="playerClubBrand" tabindex="-1" aria-hidden="true"><img class="playerClubLogo"', "Bootstrap Player shell must reserve Club-logo geometry.");

for (const token of [
  "grid-template-columns: minmax(0, 1fr) var(--mfl-player-club-logo-size, 36px);",
  ".playerHeroIdentity.playerHeroIdentityBranded {",
  ".playerClubBrand.playerClubBrandVisible {",
  ".playerClubLogo {",
]) includes(styles, token, `Player Club branding CSS is missing ${token}`);

includes(responsive, "--mfl-player-club-logo-size: clamp(26px, 7vw, 32px);", "Player Club logo must scale on tablet/mobile.");
includes(generatedPlayer, "function syncPlayerClubBrand(identity, contextValue) {", "Generated Player runtime must contain canonical Club branding.");
includes(index, '<a class="playerClubBrand" tabindex="-1" aria-hidden="true"><img class="playerClubLogo"', "Generated index must contain the stable Player Club slot.");

const identityStart = styles.indexOf(".playerHeroIdentity {");
const identityEnd = styles.indexOf(".playerHeroIdentity .playerEyebrow");
invariant(identityStart >= 0 && identityEnd > identityStart, "Player identity CSS block must remain inspectable.");
const identityRule = styles.slice(identityStart, identityEnd);
invariant(!/height\s*:/.test(identityRule), "Player Club branding must not change Player identity height.");
invariant(!/!important/.test(identityRule), "Player Club branding must not use !important geometry overrides.");

console.log("Player Club branding validation passed.");
