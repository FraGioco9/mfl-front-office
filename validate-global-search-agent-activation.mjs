import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const runtime = await read("./global-search-runtime.js");
const shared = readCanonicalCoreSource("shared");
const start = runtime.indexOf("function onAgentSearchResultClickCapture(event)");
const end = runtime.indexOf("function onSearchResultClickCapture(event)", start);
const agentActivation = start >= 0 && end > start ? runtime.slice(start, end) : "";

invariant(
  agentActivation.includes("const target = searchResultTarget(event);")
    && agentActivation.includes("if (!target) return;")
    && agentActivation.includes('const searchKey = String(target.dataset.searchKey || "").trim();')
    && agentActivation.includes('if (!searchKey.startsWith("agent:")) return;')
    && agentActivation.includes("const walletAddress = searchKey.slice(6).trim().toLowerCase();")
    && agentActivation.includes('const setPage = windowFunction("setPage");')
    && agentActivation.includes('const closeSearch = windowFunction("closeSearch");')
    && agentActivation.includes("if (!walletAddress || !setPage || !closeSearch) return;")
    && agentActivation.includes("event.preventDefault();")
    && agentActivation.includes("event.stopPropagation();")
    && !agentActivation.includes("event.stopImmediatePropagation();")
    && !agentActivation.includes("recentLoadedForSession")
    && !agentActivation.includes("navigateToAgentSearchResult")
    && !agentActivation.includes("requestAnimationFrame")
    && agentActivation.includes("closeSearch();")
    && agentActivation.includes('const mflWalletAddress = String(window.__mflAppConfig?.routes?.mflWalletAddress || "").trim().toLowerCase();')
    && agentActivation.includes('const pageName = walletAddress === mflWalletAddress ? "mfl" : "agents";')
    && agentActivation.includes('? { view: "attributes" }')
    && agentActivation.includes(': { walletAddress, view: "attributes" };')
    && agentActivation.includes("void Promise.resolve(setPage(pageName, true, options)).catch((error) => {")
    && agentActivation.includes("flushCanonicalRecentState();"),
  "Visible Agent Global Search cards must close Search and route directly from their rendered agent:<wallet> key, including the linked wallet, without openAgentPage redirects, recent-history hydration, or animation-frame deferral.",
);

invariant(
  runtime.includes('document.addEventListener("click", onSearchResultClickCapture, true);\n  document.addEventListener("click", onAgentSearchResultClickCapture, true);')
    && runtime.includes('document.removeEventListener("click", onSearchResultClickCapture, true);\n    document.removeEventListener("click", onAgentSearchResultClickCapture, true);'),
  "Agent Global Search activation must be installed after recent-result promotion and removed with the Global Search runtime.",
);

invariant(
  !shared.includes("function clickedMflWallet(event)")
    && !shared.includes('window.location.assign("/mfl/attributes");')
    && !shared.includes("event.stopImmediatePropagation();\n\n    if (typeof closeSearch === \"function\") closeSearch();"),
  "Shared core must not restore the retired document-wide MFL Wallet click interceptor.",
);
invariant(
  shared.includes('if (normalizedWalletAddress === mflWalletAddress) {\n    return pagePath("mfl", { view: preferredViewForPage("mfl") });')
    && shared.includes('if (normalizedWalletAddress === mflWalletAddress) {\n    setPage("mfl", true);'),
  "Canonical shared Agent routing must retain explicit MFL Wallet route ownership without text-sniffing click interception.",
);

console.log("Global Search Agent activation is DOM-keyed, hydration-independent, direct-routed, and isolated from Player/Club result navigation without the retired document-wide MFL Wallet interceptor.");
