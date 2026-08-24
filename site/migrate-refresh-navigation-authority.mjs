import { readFile, writeFile } from "node:fs/promises";

const appCorePath = new URL("./modules/app-core.js", import.meta.url);
const startupValidationPath = new URL("./validate-app-core-startup-handshake.mjs", import.meta.url);

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Found duplicate ${label}.`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let appCore = await readFile(appCorePath, "utf8");
appCore = replaceOnce(
  appCore,
  `  await Promise.allSettled(startupDependencies);\n  applyStoredWalletPermission();\n  updateAccountState();\n  updateMenuVisibility();\n  await showHomeShell(initialTarget.pageName, false, initialTarget.options);`,
  `  await Promise.allSettled(startupDependencies);\n  applyStoredWalletPermission();\n  updateAccountState();\n  updateMenuVisibility();\n  const authoritativeTarget = pageTargetFromPath(\`${'${location.pathname}${location.search}'}\`);\n  await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);`,
  "startup route commit",
);
await writeFile(appCorePath, appCore);

let validation = await readFile(startupValidationPath, "utf8");
validation = replaceOnce(
  validation,
  `includes(generatedCore, "await showHomeShell(initialTarget.pageName, false, initialTarget.options);", "The initial route must render only after its route-required startup dependency barrier.");`,
  `includes(generatedCore, 'const authoritativeTarget = pageTargetFromPath(\`${'${location.pathname}${location.search}'}\`);', "Startup must re-read the canonical route after its dependency barrier so newer refresh-time navigation stays authoritative.");\nincludes(generatedCore, "await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);", "Refresh startup must settle the currently authoritative route after its dependency barrier.");`,
  "startup handshake route assertion",
);
validation = replaceOnce(
  validation,
  `const initialRouteIndex = generatedCore.indexOf("await showHomeShell(initialTarget.pageName, false, initialTarget.options);");`,
  `const authoritativeTargetIndex = generatedCore.indexOf('const authoritativeTarget = pageTargetFromPath(\`${'${location.pathname}${location.search}'}\`);');\nconst authoritativeRouteIndex = generatedCore.indexOf("await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);");`,
  "startup route index",
);
validation = replaceOnce(
  validation,
  `invariant(permissionRefreshIndex >= 0 && startupBarrierIndex > permissionRefreshIndex && initialRouteIndex > startupBarrierIndex, "Progression permission must settle before the initial route can run its authorization redirect.");`,
  `invariant(\n  permissionRefreshIndex >= 0\n    && startupBarrierIndex > permissionRefreshIndex\n    && authoritativeTargetIndex > startupBarrierIndex\n    && authoritativeRouteIndex > authoritativeTargetIndex,\n  "Startup dependencies must settle before the live canonical route is re-read and rendered.",\n);`,
  "startup route ordering assertion",
);
validation += `\ninvariant(\n  !generatedCore.includes("await showHomeShell(initialTarget.pageName, false, initialTarget.options);"),\n  "Refresh startup must never replay the route captured before its dependency barrier.",\n);\n`;
await writeFile(startupValidationPath, validation);

console.log("Migrated refresh startup to latest-route authority.");
