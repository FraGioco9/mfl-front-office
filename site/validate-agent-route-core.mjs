import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, agentSplitter, routeLoader, routeNormalizer, buildCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-agent-chunk.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
  read("./build-app-core.mjs"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const agentCore = String(artifacts.routeChunks?.agents || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Agent split.");
invariant(agentCore.length > 2_000, "The Agent core chunk is too small to represent its route-specific view owner.");
new Function(sharedCore);
new Function(agentCore);

includes(agentSplitter, "export function splitAgentApplicationCoreRuntime(artifacts)", "Agent ownership must be a build-time application-core split.");
includes(agentSplitter, '"Agent view restrictions"', "The Agent splitter must extract the route-specific view restriction owner.");

excludes(sharedCore, 'const removedAgentViews = new Set(["current", "all"]);', "Agent-only removed-view state must not remain in the shared core.");
excludes(sharedCore, "function enforceAllowedAgentView(render = true)", "Agent-only view enforcement must not execute on unrelated routes.");
excludes(sharedCore, "setPageWithoutRemovedAgentViews", "Agent-only setPage wrapping must not execute on unrelated routes.");
excludes(sharedCore, "restoreAgentStateWithoutRemovedViews", "Agent-only saved-state wrapping must not execute on unrelated routes.");

includes(sharedCore, "function agentNameForWallet(address)", "Shared account and title naming must remain available without the Agent chunk.");
includes(sharedCore, "function openAgentPage(walletAddress)", "Player pages and Global Search must retain universal Agent navigation.");
includes(sharedCore, "function buildAgentSearchEntry(", "Global Agent search indexing must remain in the shared core.");
includes(sharedCore, "function agentWalletAddressFromUrl()", "Shared route parsing must remain available before Agent ownership loads.");

includes(agentCore, 'const removedAgentViews = new Set(["current", "all"]);', "The Agent chunk must own removed-view state.");
includes(agentCore, "function enforceAllowedAgentView(render = true)", "The Agent chunk must own Agent view enforcement.");
includes(agentCore, "setPageWithoutRemovedAgentViews", "The Agent chunk must wrap Agent navigation only after it loads.");
includes(agentCore, "restoreAgentStateWithoutRemovedViews", "The Agent chunk must own Agent saved-view normalization.");
includes(agentCore, "const observer = new MutationObserver", "The Agent-only DOM observer must move out of universal startup.");
excludes(agentCore, "function buildAgentSearchEntry(", "The Agent chunk must not own universal Agent search.");
excludes(agentCore, "function openAgentPage(walletAddress)", "The Agent chunk must not remove universal Agent navigation from shared pages.");

includes(routeLoader, 'agents: "/modules/app-core-agent-runtime.js"', "The route-core loader must map Agents to its generated chunk.");
excludes(routeLoader, 'void ensure("agents")', "Home and unrelated routes must not eagerly execute the Agent chunk.");
includes(routeNormalizer, 'await window.__mflEnsureRouteCore("agents");', "Direct Agent startup must load Agent ownership before startApp.");
includes(routeNormalizer, "return startApp();", "Application startup must begin only after any direct Agent owner is ready.");

includes(buildCore, 'const agentRuntimePath = resolve(siteRoot, "modules/app-core-agent-runtime.js");', "The build must emit a generated Agent runtime.");
includes(buildCore, "artifacts.routeChunks?.agents", "The build must consume the Agent artifact.");

const generatedAgent = await read("./modules/app-core-agent-runtime.js");
const agentBanner = "// Generated Agent core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedAgent.startsWith(agentBanner), "Generated Agent runtime must carry the build ownership banner.");
invariant(generatedAgent.slice(agentBanner.length).replace(/\s*$/, "") === agentCore.replace(/\s*$/, ""), "Generated Agent runtime must exactly match the Agent build artifact.");

console.log("Agent route-core splitting validation passed.");
