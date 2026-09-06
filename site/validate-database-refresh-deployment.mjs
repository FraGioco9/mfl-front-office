import { readWorkflowSource } from "./validation/workflow-source.mjs";

const workflowUrl = new URL("../.github/workflows/full-database-refresh.yml", import.meta.url);
const workflow = await readWorkflowSource(workflowUrl);
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const includes = (value, message) => invariant(workflow.includes(value), message);
const excludes = (value, message) => invariant(!workflow.includes(value), message);

includes(
  "--workflow vercel-site-update.yml",
  "Database-only refreshes must resolve the last explicitly published site source.",
);
includes(
  "cp builder/mfl_database.db production-site/site/api/data-files/mfl_database.db",
  "Database-only refreshes must replace the SQLite database in the published site workspace.",
);
excludes(
  "cp builder/site/api/_database.js production-site/site/api/_database.js",
  "Database-only refreshes must never mix the current database adapter into an older published site runtime.",
);
includes(
  'PUBLISHED_ADAPTER_BLOB="$(git -C production-site rev-parse HEAD:site/api/_database.js)"',
  "Database-only refreshes must pin the published database adapter before replacing data.",
);
includes(
  'CURRENT_ADAPTER_BLOB="$(git -C production-site hash-object site/api/_database.js)"',
  "Database-only refreshes must verify that the published database adapter stayed byte-identical.",
);
includes(
  "node production-site/site/build-app-core.mjs",
  "Database-only refreshes must rebuild generated application-core artifacts from the published site source before redeploying it.",
);
includes(
  'require(path.resolve("production-site/site/api/_database.js"))',
  "The fresh database must be smoke-tested through the published site's own SQLite adapter before deployment.",
);
includes(
  "--local-config site/vercel.production.json",
  "Database-only refreshes must use the same production Vercel configuration as explicit site releases.",
);
excludes(
  "fresh SQLite data/runtime adapter",
  "Database-only deployment logs must not claim that the API runtime adapter is being updated.",
);

console.log("Database-only deployment preserves the published site runtime while safely replacing compatible SQLite data.");
