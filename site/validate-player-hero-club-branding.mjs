import { includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const [api, player, playerHtml, bootstrap, styles, responsive, devCenterSvg] = await Promise.all([
  read("./api/_data-page.js"),
  read("./modules/core-sources/player.js"),
  read("./html-sources/player.html"),
  read("./bootstrap.js"),
  read("./styles-base.css"),
  read("./responsive-sources/chrome-tablet.css.inc"),
  read("./development-center-traffic-cone.svg"),
]);

includes(api, 'const playerClubId = scope === "player" && rows.length', "Player payload must derive the active Club from the canonical Player row.");
includes(api, 'const playerClub = playerClubId ? clubProfileData(playerClubId) : null;', "Player payload must reuse canonical Club profile ownership.");
includes(api, '...(scope === "player" ? { playerClub } : {}),', "Player payload must carry Club branding in the existing request.");

for (const token of [
  'const PLAYER_DEVELOPMENT_CENTER_GRADIENT = "linear-gradient(transparent 22%, rgba(255, 247, 0, 0.4))";',
  'return `linear-gradient(transparent 8%, rgba(${red}, ${green}, ${blue}, 0.65))`;',
  'function playerHeroBranding(contextValue) {',
  'if (contextIsRetired(context)) return null;',
  'if (contextIsDevelopmentCenter(context)) {',
  'logoUrl: PLAYER_DEVELOPMENT_CENTER_LOGO_URL,',
  'club: clubId ? normalizePlayerClubBrand(payload.playerClub, clubId) : null,',
  'syncPlayerHeroBranding(hero, context);',
]) includes(player, token, `Player hero branding is missing: ${token}`);

excludes(player, 'fetch("/api/', "Player hero branding must not introduce another presentation fetch.");

for (const token of [
  '<a class="playerHeroBrandMark" tabindex="-1" aria-hidden="true"><img class="playerHeroBrandLogo"',
  'gradient: "linear-gradient(transparent 22%, rgba(255, 247, 0, 0.4))"',
  'logoUrl: "/development-center-traffic-cone.svg"',
  'if (retirementRaw !== "" && Number(retirementRaw) === 0) return null;',
]) includes(playerHtml, token, `Static Player first paint is missing: ${token}`);

includes(bootstrap, '<a class="playerHeroBrandMark" tabindex="-1" aria-hidden="true"><img class="playerHeroBrandLogo"', "Bootstrap shell must reserve the affiliation mark without changing hero height.");

for (const token of [
  "position: relative;",
  "left: calc(var(--mfl-player-hero-overall-size, 100px) + 8px);",
  "width: var(--mfl-player-hero-brand-size, 108px);",
  "opacity: 0.42;",
  ".playerHeroPortraitFrame {\n  position: relative;\n  z-index: 2;",
]) includes(styles, token, `Player affiliation layering is missing: ${token}`);

includes(player, "const PLAYER_HERO_IDENTITY_OVERALL_GAP_PX = 292;", "Desktop media geometry must reserve the enlarged affiliation mark and slight portrait overlap.");
includes(player, 'media.style.gap = playerCssLength("--mfl-player-hero-media-gap", 88);', "Runtime Player media gap must match render-blocking geometry.");
includes(responsive, "--mfl-player-hero-brand-size: var(--mfl-player-portrait-height);", "Responsive affiliation mark must scale with the Player portrait.");
includes(responsive, "--mfl-player-hero-media-gap: calc(var(--mfl-player-hero-brand-size) - clamp(18px, 4vw, 26px));", "Responsive Player media gap must leave only a small overlap behind the portrait.");

for (const token of [
  'class="lucide lucide-traffic-cone"',
  '<path d="M16.05 10.966a5 2.5 0 0 1-8.1 0"></path>',
  '<path d="M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z"></path>',
]) includes(devCenterSvg, token, "Development Center traffic-cone SVG must match the supplied icon.");

console.log("Player hero Club branding validation passed.");
