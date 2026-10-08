import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createNextRewrites, outputFileTracingIncludes } from "./next.config.mjs";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const evaluationPreviewHandler = require("./api/_handler-evaluation-preview.js");
const {
  evaluationShellPath,
  browserTitleForMetadata,
  publicEvaluationPlayerName,
} = evaluationPreviewHandler;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(relativePath) {
  return readFileSync(resolve(siteRoot, relativePath), "utf8");
}

function createResponseRecorder() {
  return {
    headers: new Map(),
    statusCode: null,
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), String(value));
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

const expectedShellPath = resolve(siteRoot, "index.html");
assert(
  evaluationShellPath() === expectedShellPath,
  "Local Evaluation preview must resolve the generated SPA shell from the project root.",
);

// Simulate Next's actual deployed Pages bundle layout. The original code
// passed source-tree tests but searched .next/server/pages/index.html in Vercel.
const packagedRoot = mkdtempSync(join(tmpdir(), "mfl-evaluation-shell-"));
try {
  const bundledApiDirectory = resolve(packagedRoot, ".next", "server", "pages", "api");
  const sourceApiDirectory = resolve(packagedRoot, "api");
  const packagedShell = resolve(packagedRoot, "index.html");
  mkdirSync(bundledApiDirectory, { recursive: true });
  mkdirSync(sourceApiDirectory, { recursive: true });
  writeFileSync(packagedShell, "<title>MFL Front Office</title>", "utf8");

  assert(
    evaluationShellPath({
      workingDirectory: packagedRoot,
      moduleDirectory: bundledApiDirectory,
    }) === packagedShell,
    "Bundled Evaluation preview must prioritize the traced shell at the deployment project root.",
  );
  assert(
    evaluationShellPath({
      workingDirectory: resolve(packagedRoot, "non-project-working-dir"),
      moduleDirectory: bundledApiDirectory,
    }) === packagedShell,
    "Bundled Evaluation preview must also recover the traced root shell from the compiled module location.",
  );
  assert(
    evaluationShellPath({
      workingDirectory: resolve(packagedRoot, "non-project-working-dir"),
      moduleDirectory: sourceApiDirectory,
    }) === packagedShell,
    "Unbundled Evaluation preview must preserve the source-tree fallback.",
  );
} finally {
  rmSync(packagedRoot, { recursive: true, force: true });
}
assert(
  browserTitleForMetadata({}) === "Evaluation - MFL Front Office",
  "Blank Evaluation browser titles must use the canonical Evaluation fallback.",
);
assert(
  browserTitleForMetadata({ playerName: "Name Surname" }) === "Evaluation - Name Surname - MFL Front Office",
  "Resolved Evaluation browser titles must use the canonical full Player identity and app suffix.",
);
assert(
  browserTitleForMetadata({ playerName: "  Name   Surname  " }) === "Evaluation - Name Surname - MFL Front Office",
  "Evaluation browser titles must normalize Player identity whitespace consistently.",
);
assert(
  browserTitleForMetadata({}, "  Name   Surname  ") === "Evaluation - Name Surname - MFL Front Office",
  "Direct Evaluation HTML must be able to use packaged public Player identity before client hydration.",
);
assert(publicEvaluationPlayerName("missing-player") === "", "Invalid Player IDs must not trigger public title lookup.");

const previewSource = readText("api/_handler-evaluation-preview.js");
assert(
  previewSource.includes('path.resolve(workingDirectory, "index.html")')
    && previewSource.includes('path.resolve(moduleDirectory, "..", "..", "..", "..", "index.html")')
    && previewSource.includes("fs.existsSync(candidate)"),
  "Evaluation preview must resolve the traced project-root HTML across source and compiled Next layouts.",
);
assert(
  !previewSource.includes('return path.resolve(__dirname, "..", "index.html");'),
  "Evaluation preview must not return only the obsolete compiled-Pages-relative path.",
);
assert(
  previewSource.includes('queryOne("SELECT name FROM players WHERE player_id = ? LIMIT 1", [playerId])')
    && previewSource.includes("const earlyPlayerName = publicEvaluationPlayerName(playerId);"),
  "Direct Evaluation refreshes must resolve public Player identity from the already-bundled database before client hydration when a Player ID is present.",
);
assert(
  previewSource.includes("const browserTitle = htmlEscape(browserTitleForMetadata(metadata, fallbackPlayerName));"),
  "Direct Evaluation HTML must keep browser-title ownership separate from social preview metadata while accepting earlier public identity.",
);

const previewIncludes = outputFileTracingIncludes["/api/evaluation-preview"] || [];
assert(
  previewIncludes.some((value) => String(value).includes("index.html")),
  "Next tracing must bundle index.html with the Evaluation preview route.",
);
assert(
  previewIncludes.some((value) => String(value).includes("api/data-files/mfl_database.db")),
  "Next tracing must keep the packaged public database available for early Evaluation Player titles.",
);
const nextRewrites = createNextRewrites();
assert(
  nextRewrites.beforeFiles?.some((rewrite) => rewrite.source === "/evaluation"
    && rewrite.destination === "/api/evaluation-preview"
    && !rewrite.has?.length),
  "Next must route every direct /evaluation request (with or without share) through the preview-aware SPA shell handler.",
);

const envKeys = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
for (const key of envKeys) delete process.env[key];

try {
  const refreshCases = [
    ["plain", "/evaluation"],
    ["selected player", "/evaluation?player=12345"],
    ["broken player", "/evaluation?player=missing-player"],
    ["saved Evaluation", "/evaluation?saved=abcd1234"],
    ["saved Evaluation with player", "/evaluation?player=12345&saved=abcd1234"],
    ["broken saved Evaluation", "/evaluation?player=missing-player&saved=missing-save"],
    ["shared Evaluation", "/evaluation?player=12345&share=abcd1234"],
    ["broken shared Evaluation", "/evaluation?player=missing-player&share=missing-share"],
    ["share-only Evaluation", "/evaluation?share=abcd1234"],
  ];

  for (const [label, url] of refreshCases) {
    const response = createResponseRecorder();
    await evaluationPreviewHandler(
      {
        method: "GET",
        url,
        headers: {
          host: "mfl-front-office.vercel.app",
          "x-forwarded-proto": "https",
        },
      },
      response,
    );
    assert(response.statusCode === 200, `${label} refresh must return the Evaluation SPA shell with HTTP 200.`);
    assert(response.ended, `${label} refresh must finish the response.`);
    assert(response.headers.get("cache-control") === "no-store, max-age=0",
      `${label} preview HTML must remain uncached because shares are revocable.`);
    assert(response.body.includes('property="og:image"')
      && response.body.includes('name="twitter:card" content="summary_large_image"'),
      `${label} preview HTML must advertise a dynamic social-preview image.`);
    const requestUrl = new URL(url, "https://mfl-front-office.vercel.app");
    const playerName = publicEvaluationPlayerName(requestUrl.searchParams.get("player"));
    const expectedTitle = browserTitleForMetadata({}, playerName);
    assert(
      typeof response.body === "string"
        && response.body.includes(`<title>${expectedTitle}</title>`),
      `${label} refresh must start with the earliest canonical Evaluation browser title available from its route identity.`,
    );
    assert(
      !response.body.includes("<title>Shared Evaluation - MFL Front Office</title>"),
      `${label} refresh must never label an unresolved browser tab as Shared Evaluation.`,
    );
  }

  const headResponse = createResponseRecorder();
  await evaluationPreviewHandler(
    {
      method: "HEAD",
      url: "/evaluation?player=12345&share=abcd1234",
      headers: {
        host: "mfl-front-office.vercel.app",
        "x-forwarded-proto": "https",
      },
    },
    headResponse,
  );
  assert(headResponse.statusCode === 200 && headResponse.ended, "Evaluation HEAD refresh must complete with HTTP 200.");
  assert(headResponse.body === null, "Evaluation HEAD refresh must not send an HTML body.");
} finally {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

console.log("Evaluation preview shell-path and earliest canonical browser-title validation passed for plain, player, saved, shared, and broken Evaluation URLs.");
