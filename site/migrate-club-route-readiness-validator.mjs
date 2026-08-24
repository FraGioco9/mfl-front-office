// Temporary one-shot Club route validator migration; remove after the readiness-ordering commit.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "validate-club-route-core.mjs");
const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = `includes(appEntry, "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;\\ninstallClubRouteRuntimeGate();", "The single Club gate must exist before application-core startup begins.");`;
const after = `includes(appEntry, "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;", "The route-runtime gate API must exist before application startup.");\nincludes(appEntry, "runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady;", "The route-runtime readiness API must exist before application startup.");\nconst clubGateInstall = appEntry.indexOf("installClubRouteRuntimeGate();", appEntry.indexOf("runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady;"));\nconst appStartup = appEntry.indexOf("void start().catch(showStartupError);", clubGateInstall);\ninvariant(clubGateInstall >= 0 && appStartup > clubGateInstall, "The single Club gate must exist before application-core startup begins.");`;
if (!source.includes(before)) throw new Error("Missing stale Club gate adjacency assertion.");
await writeFile(path, source.replace(before, after));
console.log("Updated Club route-core readiness ordering assertion.");
