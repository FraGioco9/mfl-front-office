import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const evaluationPreviewHandler = require("./api/evaluation-preview.js");
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
  "Evaluation preview must resolve the SPA shell relative to api, not the serverless runtime working directory.",
);
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

const previewSource = readText("api/evaluation-preview.js");
assert(
  previewSource.includes('path.resolve(__dirname, "..", "index.html")'),
  "Evaluation preview must derive index.html from its deployed module directory.",
);
assert(
  !previewSource.includes('path.join(process.cwd(), "index.html")')
    && !previewSource.includes('path.resolve(process.cwd(), "index.html")'),
  "Evaluation preview must not assume the Vercel function working directory contains index.html.",
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

for (const configPath of ["vercel.json", "vercel.production.json"]) {
  const config = JSON.parse(readText(configPath));
  const previewFunction = config.functions?.["api/evaluation-preview.js"];
  assert(
    String(previewFunction?.includeFiles || "").includes("index.html"),
    `${configPath} must bundle index.html with the Evaluation preview function.`,
  );
  assert(
    String(previewFunction?.includeFiles || "").includes("api/data-files/mfl_database.db"),
    `${configPath} must keep the packaged public database available for early Evaluation Player titles.`,
  );
  assert(
    config.rewrites?.some((rewrite) => rewrite.source === "/evaluation" && rewrite.destination === "/api/evaluation-preview"),
    `${configPath} must route every direct /evaluation request through the preview-aware SPA shell handler.`,
  );
}

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
