import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

const cardStyles = source("my-clubs.css");
const loadingStyles = source("loading.css");
const baseStyles = source("styles-base.css");
const generatedStyles = source("styles-runtime.css");
const cardRuntime = source("modules/core-sources/my-clubs.js");
const clubRuntime = source("modules/core-sources/club.js");
const bootstrap = source("bootstrap.js");

function rule(css, selector) {
  const prefix = `${selector} {\n`;
  const beginning = css.indexOf(prefix);
  assert.notEqual(beginning, -1, `Missing ${selector} CSS rule.`);
  const ending = css.indexOf("\n}", beginning + prefix.length);
  assert.notEqual(ending, -1, `Unclosed ${selector} CSS rule.`);
  return css.slice(beginning, ending + 2);
}

// A cold-load logo frame already has the club-colour gradient underneath.
// Its placeholder must never paint a solid block over that colour.
for (const [css, selector] of [
  [cardStyles, ".myClubLogoFrameLoading"],
  [loadingStyles, ".clubIdentityLogoSkeleton.mflDataPlaceholder"],
]) {
  const declaration = rule(css, selector);
  assert.match(declaration, /\bbackground:\s*transparent\s*;/u, `${selector} must be transparent on cold load.`);
  assert.doesNotMatch(declaration, /mfl-loading-placeholder-surface|#fff(?:fff)?\b|\bwhite\b/u, `${selector} must not mask the club gradient.`);
  assert.ok(generatedStyles.includes(declaration), `Generated CSS is missing the transparent ${selector} rule.`);
}

assert.match(rule(cardStyles, ".myClubLogoFrame"), /background:\s*transparent;/u);
assert.match(rule(baseStyles, ".clubIdentityLogoFrame"), /background:\s*transparent;/u);
assert.match(baseStyles, /\.clubIdentityLogo,\n\.clubIdentityLogoSkeleton \{[\s\S]*?max-height: var\(--mfl-club-identity-logo-height\);/u);

// Both cold and warm paths must retain their existing image/error handling;
// the fix changes only the visual placeholder, not the image request lifecycle.
assert.match(cardRuntime, /logoFrame\.className = "myClubLogoFrame myClubLogoFrameLoading";/u);
assert.match(cardRuntime, /logoFrame\.className = "myClubLogoFrame";/u);
assert.match(cardRuntime, /logo\.addEventListener\("error",/u);
assert.match(clubRuntime, /if \(logo\.src !== resolvedLogoUrl\) logo\.src = canonicalLogoUrl;/u);
assert.match(bootstrap, /createDataPlaceholder\("clubIdentityLogoSkeleton"\)/u);

console.log("Club-logo cold-load regression PASS: opaque loading masks removed, shared sizing and warm/error paths preserved.");
