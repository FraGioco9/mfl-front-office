import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const evaluationPreviewHandler = require("./api/evaluation-preview.js");
const { evaluationShellPath } = evaluationPreviewHandler;

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
  "Evaluation preview must resolve the SPA shell relative to site/api, not the serverless runtime working directory.",
);

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

for (const configPath of ["vercel.json", "vercel.production.json"]) {
  const config = JSON.parse(readText(configPath));
  const previewFunction = config.functions?.["api/evaluation-preview.js"];
  assert(
    String(previewFunction?.includeFiles || "").includes("index.html"),
    `${configPath} must bundle index.html with the Evaluation preview function.`,
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
    ["saved Evaluation", "/evaluation?save=abcd1234"],
    ["saved Evaluation with player", "/evaluation?player=12345&save=abcd1234"],
    ["broken saved Evaluation", "/evaluation?player=missing-player&save=missing-save"],
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
    assert(
      typeof response.body === "string"
        && response.body.includes("<title>")
        && response.body.includes("MFL Front Office"),
      `${label} refresh must return the MFL Front Office HTML shell.`,
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

console.log("Evaluation preview shell-path and direct-refresh validation passed for plain, player, saved, shared, and broken Evaluation URLs.");
