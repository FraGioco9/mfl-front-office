import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(siteRoot, "..");
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const [rootPackageSource, readme, ownership, guardrails, qualityScope] = await Promise.all([
  readRepository("package.json"),
  readRepository("README.md"),
  readRepository("docs/ownership.md"),
  readRepository("docs/architecture-guardrails.md"),
  readRepository("site/ci-quality-scope.mjs"),
]);

const rootPackage = JSON.parse(rootPackageSource);
invariant(rootPackage.private === true, "Root package.json must remain private.");
invariant(rootPackage.engines?.node === "22.x", "Root local development must use the canonical Node 22 runtime.");
invariant(
  rootPackage.scripts?.dev === "vercel dev --cwd site --listen 4000",
  "Root npm run dev must target the site Vercel project on port 4000 without recursively resolving the root dev script.",
);
invariant(
  rootPackage.scripts?.check === "npm --prefix site run check",
  "Root npm run check must forward to the canonical site check owner.",
);

for (const forbidden of [
  "prepare_runtime_database",
  "npm --prefix site run build",
  "npm --prefix site run build:",
]) {
  invariant(
    !String(rootPackage.scripts?.dev || "").includes(forbidden),
    `Root npm run dev must not gain automatic database/generated-asset work: ${forbidden}`,
  );
}

invariant(
  readme.includes("npm run dev")
    && readme.includes("port **4000**")
    && readme.includes("does **not** rebuild the database or regenerate tracked site artifacts"),
  "README must document the canonical root dev command and its explicit ownership boundaries.",
);
invariant(
  ownership.includes("Root `package.json` owns the canonical local-development entry point.")
    && ownership.includes("`npm run dev` is a thin wrapper around `vercel dev --cwd site --listen 4000`"),
  "Ownership documentation must identify the root dev command owner.",
);
invariant(
  guardrails.includes("### Root local-development entry point — keep")
    && guardrails.includes("Site Quality remains the generated-artifact writer"),
  "Architectural guardrails must retain the root dev/generated-artifact boundary.",
);
invariant(
  qualityScope.includes('file === "package.json"')
    && qualityScope.includes('file === "README.md"')
    && qualityScope.includes('file === "docs/ownership.md"')
    && qualityScope.includes('file === "docs/architecture-guardrails.md"'),
  "CI scope detection must validate changes to canonical root development ownership.",
);

console.log("Canonical root npm development workflow and ownership validation passed.");
