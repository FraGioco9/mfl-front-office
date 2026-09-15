import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [
  packageSource,
  nextConfig,
  prepareRuntime,
  legacyAssetOwnership,
  legacyDevLoader,
  legacyDevBridge,
  documentSource,
  readme,
  ownership,
  guardrails,
  qualityWorkflow,
] = await Promise.all([
  read("package.json"),
  read("next.config.mjs"),
  read("prepare-next-runtime.mjs"),
  read("legacy-public-assets.cjs"),
  read("dev-legacy-watch-loader.cjs"),
  read("next-dev-legacy-bridge.mjs"),
  read("pages/_document.js"),
  read("README.md"),
  read("docs/ownership.md"),
  read("docs/architecture-guardrails.md"),
  read(".github/workflows/site-quality.yml"),
]);

const packageJson = JSON.parse(packageSource);
invariant(packageJson.private === true, "Root package.json must remain private.");
invariant(packageJson.engines?.node === "22.x", "Next runtime must remain on the supported Node 22 line.");
invariant(packageJson.dependencies?.next === "16.3.4", "MFL Front Office must use the pinned Next.js runtime.");
invariant(packageJson.dependencies?.react === "19.2.6" && packageJson.dependencies?.["react-dom"] === "19.2.6", "Next runtime must use the shared React 19.2.6 runtime pair.");
invariant(packageJson.overrides?.["use-sync-external-store"] === "1.6.0", "WalletConnect compatibility must use the React-19-capable external-store shim.");
invariant(packageJson.scripts?.predev === "node prepare-next-runtime.mjs", "npm predev must prepare the temporary legacy public projection before Next starts.");
invariant(packageJson.scripts?.dev === "next dev --webpack -p 4000", "npm run dev must directly start Next.js Webpack development mode on port 4000, matching the standard Next development lifecycle used by the sibling projects.");
invariant(packageJson.scripts?.start === "next start -p 4000", "npm run start must own the production Next server.");
invariant(String(packageJson.scripts?.build || "").endsWith("next build"), "npm run build must finish with next build.");
invariant(!packageSource.includes("local-dev-server.mjs") && !packageSource.includes("vercel dev"), "Local startup must not use the retired custom/Vercel dev servers.");

invariant(nextConfig.includes('fallback: [{ source: "/:path*", destination: "/index.html" }]'), "Next must preserve SPA deep-link fallback.");
invariant(
  nextConfig.includes('source: "/evaluation"')
    && nextConfig.includes('has: [{ type: "query", key: "share" }]')
    && nextConfig.includes('destination: "/api/evaluation-preview"'),
  "Next must preserve shared Evaluation preview routing while ordinary Evaluation remains Next-rendered.",
);
invariant(nextConfig.includes('"/api/data": ["./api/data-files/mfl_database.db"]'), "Next tracing must retain the SQLite database for the data API.");
invariant(prepareRuntime.includes("export async function prepareNextRuntime()"), "Next public compatibility projection must expose a reusable development/build sync function.");
invariant(prepareRuntime.includes("listLegacyPublicAssetPaths(root)"), "Next public projection must consume the shared legacy asset owner.");
invariant(legacyAssetOwnership.includes("isLegacyPublicAssetRelativePath") && legacyAssetOwnership.includes("listLegacyPublicAssetPaths"), "Legacy public projection scope must have one shared owner.");
invariant(legacyDevLoader.includes("this.addDependency(absolutePath)") && legacyDevLoader.includes('createHash("sha256")'), "Next development must watch projected legacy assets through a content-sensitive Webpack dependency.");
invariant(legacyDevBridge.includes("compiler.hooks.watchRun.tapPromise") && legacyDevBridge.includes("prepareNextRuntime()"), "Next development must resync public compatibility assets before rebuilding after a watched legacy change.");
invariant(nextConfig.includes("dev-legacy-watch-loader.cjs") && nextConfig.includes("MflLegacyDevBridgePlugin"), "Next Webpack development config must install the legacy HMR bridge.");
invariant(documentSource.includes("legacyDevWatchToken") && documentSource.includes('"data-mfl-dev-assets"'), "The Next document must consume the legacy watch token so legacy changes invalidate the visible document.");

for (const route of ["data", "wallet-session", "evaluation-preview", "wallet-preferences"]) {
  const wrapper = await read(`pages/api/${route}.js`);
  invariant(wrapper.includes(`../../api/${route}.js`), `Next API wrapper missing canonical ${route} handler.`);
  invariant(wrapper.includes("export default handler;"), `Next API wrapper must expose the canonical ${route} handler as a Pages API default export.`);
  invariant(wrapper.includes("bodyParser: false"), `Next API wrapper must preserve the canonical raw request-body contract for ${route}.`);
}

invariant(
  qualityWorkflow.includes("Next runtime smoke test")
    && qualityWorkflow.includes("npx next start -p 4010")
    && qualityWorkflow.includes("/database/attributes")
    && qualityWorkflow.includes("/api/wallet-session")
    && qualityWorkflow.includes("windows-next-dev-smoke:")
    && qualityWorkflow.includes("runs-on: windows-latest")
    && qualityWorkflow.includes("/api/identity")
    && qualityWorkflow.includes('Invalid wallet proof.'),
  "Site Quality must smoke-test the real built Next runtime and the exact Windows development SQLite path through a deterministic fixture.",
);
invariant(readme.includes("Next.js") && readme.includes("next dev --webpack -p 4000"), "README must document Next runtime ownership.");
invariant(
  ownership.includes("next dev --webpack -p 4000")
    && ownership.includes("public/")
    && ownership.includes("automatically refresh"),
  "Ownership docs must describe the Next compatibility projection and automatic development refresh boundary.",
);
invariant(guardrails.includes("Next.js runtime"), "Architecture guardrails must retain Next runtime ownership.");

console.log("Canonical Next.js local/build/runtime ownership validation passed.");
