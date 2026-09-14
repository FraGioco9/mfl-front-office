import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalDevelopmentServer } from "./local-dev-server.mjs";

const repositoryRoot = dirname(fileURLToPath(import.meta.url));
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const [packageSource, readme, ownership, guardrails, qualityScope, vercelSource, devServer] = await Promise.all([
  readRepository("package.json"),
  readRepository("README.md"),
  readRepository("docs/ownership.md"),
  readRepository("docs/architecture-guardrails.md"),
  readRepository("ci-quality-scope.mjs"),
  readRepository("vercel.json"),
  readRepository("local-dev-server.mjs"),
]);

const packageJson = JSON.parse(packageSource);
const vercelConfig = JSON.parse(vercelSource);
invariant(packageJson.private === true, "Root package.json must remain private.");
invariant(packageJson.name === "mfl-front-office", "Root package.json must own the application package identity.");
invariant(packageJson.engines?.node === "22.x", "Root local development must use the canonical Node 22 runtime.");
invariant(
  packageJson.scripts?.dev === "node local-dev-server.mjs",
  "Root npm run dev must start the repository-owned local development server directly.",
);
invariant(
  packageJson.scripts?.check === "npm run lint && npm run typecheck && npm run build && npm run verify:generated && npm run validate",
  "Root npm run check must own the complete canonical application quality path.",
);
invariant(!vercelConfig.devCommand, "Local startup must not be delegated back to Vercel.");
invariant(
  devServer.includes("createLocalDevelopmentServer")
    && devServer.includes("request.query = queryObject")
    && devServer.includes("response.status =")
    && devServer.includes("response.json =")
    && devServer.includes("response.send =")
    && devServer.includes('resolve(root, "api"')
    && devServer.includes('process.loadEnvFile(path)'),
  "The local development server must own SPA assets, Vercel-compatible API dispatch, and root .env.local loading.",
);

for (const forbidden of ["vercel dev", "--cwd site", "prepare_runtime_database", "npm run build"]) {
  invariant(
    !String(packageJson.scripts?.dev || "").includes(forbidden),
    `Root npm run dev must stay an independent local-runtime entry point: ${forbidden}`,
  );
}

const previousSecret = process.env.WALLET_CHALLENGE_SECRET;
const previousOrigin = process.env.WALLET_CHALLENGE_ORIGIN;
const previousVercelUrl = process.env.VERCEL_URL;
process.env.WALLET_CHALLENGE_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
delete process.env.WALLET_CHALLENGE_ORIGIN;
delete process.env.VERCEL_URL;

const server = createLocalDevelopmentServer();
try {
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  invariant(address && typeof address === "object", "Local development server must expose its test port.");
  const rootResponse = await fetch(`http://127.0.0.1:${address.port}/`);
  const rootHtml = await rootResponse.text();
  invariant(
    rootResponse.status === 200 && rootHtml.includes("<title>") && rootHtml.includes("MFL Front Office"),
    "Local development root must serve the real SPA shell.",
  );
  const deepRouteResponse = await fetch(`http://127.0.0.1:${address.port}/database/attributes`);
  const deepRouteHtml = await deepRouteResponse.text();
  invariant(
    deepRouteResponse.status === 200 && deepRouteHtml.includes("MFL Front Office"),
    "Local development deep links must fall back to the SPA shell.",
  );

  const response = await fetch(`http://127.0.0.1:${address.port}/api/wallet-session`);
  const payload = await response.json();
  invariant(response.status === 200, "Local wallet-session GET must execute through the real API handler.");
  invariant(
    typeof payload.token === "string"
      && /^[0-9a-f]{64}$/.test(String(payload.nonce || ""))
      && String(payload.message || "").includes(`Origin: http://127.0.0.1:${address.port}`),
    "Local wallet-session challenge must preserve the request-derived localhost origin.",
  );
} finally {
  await new Promise((resolvePromise) => server.close(resolvePromise));
  if (previousSecret === undefined) delete process.env.WALLET_CHALLENGE_SECRET;
  else process.env.WALLET_CHALLENGE_SECRET = previousSecret;
  if (previousOrigin === undefined) delete process.env.WALLET_CHALLENGE_ORIGIN;
  else process.env.WALLET_CHALLENGE_ORIGIN = previousOrigin;
  if (previousVercelUrl === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = previousVercelUrl;
}

invariant(
  readme.includes("npm run dev")
    && readme.includes("local-dev-server.mjs")
    && readme.includes("port **4000**")
    && readme.includes("does **not** rebuild the database or regenerate tracked site artifacts"),
  "README must document the canonical root dev command and its ownership boundaries.",
);
invariant(
  ownership.includes("single application package")
    && ownership.includes("node local-dev-server.mjs")
    && ownership.includes("Vercel remains the production/deployment runtime"),
  "Ownership documentation must identify the flattened root application and local runtime owner.",
);
invariant(
  guardrails.includes("### Root local-development entry point — keep")
    && guardrails.includes("one repository root")
    && guardrails.includes("Site Quality remains the generated-artifact writer"),
  "Architectural guardrails must retain the root dev/generated-artifact boundary.",
);
invariant(
  qualityScope.includes('file.startsWith("api/")')
    && qualityScope.includes('file.startsWith("modules/")')
    && qualityScope.includes('rootApplicationFile'),
  "CI scope detection must validate the flattened application root.",
);

console.log("Canonical flattened root npm development workflow, real API dispatch, and ownership validation passed.");
