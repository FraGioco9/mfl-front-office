import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const appEntry = await readValidationText("./modules/app-entry.js", import.meta.url);

for (const token of [
  "const nativeFetch = window.fetch.bind(window);",
  "function isSameOriginApiRequest(input) {",
  "function createDataClient({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {",
  "const inFlight = new Map();",
  "const responseCache = new Map();",
  "function canonicalRequestKey(input, init, headers) {",
  "function composeRequestSignal(callerSignal, timeoutMs) {",
  "const timeout = composeRequestSignal(callerSignal, Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));",
  "const dedupe = method === \"GET\" && options.dedupe === true;",
  "const cacheTtlMs = method === \"GET\" ? Math.max(0, Number(options.cacheTtlMs) || 0) : 0;",
  "const response = await nativeFetch(input, requestInit);",
  "window.dispatchEvent(new CustomEvent(\"mfl:data-client-timing\"",
  "const dataClient = createDataClient();",
  "runtimeWindow.__mflDataClient = dataClient;",
]) {
  includes(appEntry, token, `Canonical data client foundation is missing: ${token}`);
}

invariant(
  appEntry.includes("callerSignal?.addEventListener(\"abort\", abortFromCaller, { once: true });")
    && appEntry.includes("window.setTimeout(() => controller.abort(new DOMException(\"Request timed out.\", \"TimeoutError\")), timeoutMs)"),
  "Caller cancellation and the canonical timeout must be composed instead of allowing caller signals to bypass the deadline.",
);

invariant(
  appEntry.includes("if (!isSameOriginApiRequest(input)) return nativeFetch(input, init);")
    && appEntry.includes("const response = await nativeFetch(input, requestInit);"),
  "The canonical data client must retain native fetch only as its underlying transport and for non-API requests.",
);

for (const retiredBridgeToken of [
  "function installDataClientCompatibilityBridge(",
  "installDataClientCompatibilityBridge(dataClient);",
  "window.fetch =",
  "__mflApiFetchPolicyInstalled",
]) {
  excludes(appEntry, retiredBridgeToken, `The retired global fetch compatibility bridge must not return: ${retiredBridgeToken}`);
}

excludes(appEntry, "function installApiFetchPolicy", "Legacy app-entry API transport ownership must remain removed after the canonical data client is introduced.");
excludes(appEntry, "if (callerSignal) {\n      requestInit.signal = callerSignal;\n      return nativeFetch", "Caller-provided signals must not bypass the canonical request timeout.");

console.log("Canonical frontend data client explicitly owns API request identity, deadlines, optional dedupe/cache hooks, timing, and transport without global fetch interception.");
