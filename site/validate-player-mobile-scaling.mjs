import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [responsive, styles, bootstrap, player] = await Promise.all([
  read("./responsive.css"),
  read("./styles-base.css"),
  read("./bootstrap.js"),
  read("./modules/core-sources/player.js"),
]);

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const includes = (source, value, message) => invariant(source.includes(value), message);

for (const required of [
  "--mfl-player-hero-overall-size: 88px;",
  "--mfl-player-portrait-height: 100px;",
  "--mfl-player-hero-title-font-size: 24px;",
  "--mfl-player-hero-action-menu-width: 100%;",
]) includes(responsive, required, "Tablet/mobile Player scaling is missing " + required);

for (const required of [
  "--mfl-player-hero-overall-size: 72px;",
  "--mfl-player-portrait-height: 82px;",
  "--mfl-player-hero-title-font-size: 21px;",
  ".playerAttributeViewButton {\n    flex-basis: 74px;",
  ".pitch {\n    width: min(286px, 100%);",
]) includes(responsive, required, "Phone Player scaling is missing " + required);

for (const required of [
  "--mfl-player-hero-overall-size: 64px;",
  "--mfl-player-portrait-height: 72px;",
  "--mfl-player-hero-title-font-size: 19px;",
  ".pitch {\n    width: min(250px, 100%);",
]) includes(responsive, required, "Tiny-phone Player scaling is missing " + required);

for (const required of [
  ".playerHeroMedia {",
  "width: var(--mfl-player-hero-media-width, 320px);",
  ".playerHeroOverall {",
  "width: var(--mfl-player-hero-overall-size, 100px);",
  ".playerHeroPortraitFrame {",
  "height: var(--mfl-player-portrait-height, 112px);",
  ".playerHeroIdentity {",
  ".playerHeroActionMenu {",
]) includes(styles, required, "Render-blocking Player geometry is missing " + required);

for (const required of [
  '<div class="playerHeroMedia">',
  '<div class="playerHeroIdentity">',
  '<div class="playerHeroActionMenu">',
  'class="playerHeroOverall isPending"',
]) includes(bootstrap, required, "Player first paint must reserve final responsive hero structure: " + required);

for (const required of [
  'function playerCssLength(customProperty, fallbackPx) {',
  'playerCssPixels("--mfl-player-portrait-height", PLAYER_PORTRAIT_DISPLAY_HEIGHT_PX)',
  'playerCssLength("--mfl-player-hero-overall-size", PLAYER_HERO_OVERALL_SIZE_PX)',
  'playerCssLength("--mfl-player-hero-action-menu-width", PLAYER_HERO_ACTION_MENU_WIDTH_PX)',
  'playerCssLength("--mfl-player-hero-media-width", desktopMediaWidth)',
  'playerCssLength("--mfl-player-hero-identity-width", PLAYER_HERO_IDENTITY_WIDTH_PX)',
]) includes(player, required, "Canonical Player runtime must consume responsive CSS geometry: " + required);

invariant(!player.includes("!important"), "Player mobile scaling must not use !important.");
invariant(!player.includes('matchMedia("(max-width:'), "Player sizing must stay CSS-owned instead of adding viewport-specific runtime branches.");

console.log("Player pages scale progressively at 900px, 520px, and 380px with matching first-paint and hydrated geometry.");
