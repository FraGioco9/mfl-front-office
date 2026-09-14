import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [packageSource, nextConfig, prepareRuntime, readme, ownership, guardrails, qualityWorkflow] = await Promise.all([
  read("package.json"),
  read("next.config.mjs"),
  read("prepare-next-runtime.mjs"),
  read("README.md"),
  read("docs/ownership.md"),
  read("docs/architecture-guardrails.md"),
  read(".github/workflows/site-quality.yml"),
]);

const packageJson = JSON.parse(packageSource);
invariant(packageJson.private === true, "Root package.json must remain private.");
invariant(packageJson.engines?.node === "22.x", "Next runtime must remain on the supported Node 22 line.");
invariant(packageJson.dependencies?.next === "16.3.4", "MFL Front Office must use the pinned Next.js runtime.");
invariant(packageJson.dependencies?.react === "18.3.1" && packageJson.dependencies?.["react-dom"] === "18.3.1", "Next runtime must use the wallet-compatible pinned React pair.");
invariant(packageJson.scripts?.dev === "node prepare-next-runtime.mjs && next dev --webpack -p 4000", "npm run dev must start Next.js Webpack development mode on port 4000 so native node:sqlite remains Node-owned on Windows.");
invariant(packageJson.scripts?.start === "next start -p 4000", "npm run start must own the production Next server.");
invariant(String(packageJson.scripts?.build || "").endsWith("next build"), "npm run build must finish with next build.");
invariant(!packageSource.includes("local-dev-server.mjs") && !packageSource.includes("vercel dev"), "Local startup must not use the retired custom/Vercel dev servers.");

invariant(nextConfig.includes('fallback: [{ source: "/:path*", destination: "/index.html" }]'), "Next must preserve SPA deep-link fallback.");
invariant(nextConfig.includes('{ source: "/evaluation", destination: "/api/evaluation-preview" }'), "Next must preserve Evaluation preview routing.");
invariant(nextConfig.includes('"/api/data": ["./api/data-files/mfl_database.db"]'), "Next tracing must retain the SQLite database for the data API.");
invariant(prepareRuntime.includes('await rm(publicRoot, { recursive: true, force: true })'), "Next public compatibility projection must be rebuilt deterministically.");
invariant(prepareRuntime.includes('name.endsWith("-runtime.js")'), "Next public projection must include runtime browser assets.");
invariant(prepareRuntime.includes('entry.name === "app-entry.js"'), "Next public projection must include the browser application entry module.");
invariant(prepareRuntime.includes('join("modules", entry.name)'), "Next public projection must include generated application-core runtimes.");

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
invariant(ownership.includes("Next.js") && ownership.includes("public/"), "Ownership docs must describe the Next compatibility boundary.");
invariant(guardrails.includes("Next.js runtime"), "Architecture guardrails must retain Next runtime ownership.");

console.log("Canonical Next.js local/build/runtime ownership validation passed.");
