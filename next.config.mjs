import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MflLegacyDevBridgePlugin } from "./next-dev-legacy-bridge.mjs";
import { resolveDeploymentCommit } from "./deployment-commit.mjs";
import { cspLegacyScriptHashes } from "./csp-legacy-script-hashes.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const deploymentCommit = resolveDeploymentCommit({ root });

const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0" }];
const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

export const securityHeaders = Object.freeze([
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
]);


// SEC-04 phase 1: observability only. Never merge into the enforced CSP without
// browser validation of inline legacy scripts, Next runtime, and FCL/Dapper.
// Hashes keep known parser-time legacy scripts eligible without delaying first paint.
// Next's dynamic inline bootstrap still requires a request-scoped nonce strategy.
export const cspScriptSources = Object.freeze(["'self'", "https://esm.sh", ...cspLegacyScriptHashes]);
export const cspReportOnly = Object.freeze([
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  `script-src ${cspScriptSources.join(" ")}`,
  `script-src-elem ${cspScriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "media-src 'self' https: blob:",
  "form-action 'self' https:",
  "report-uri /api/csp-report",
  "report-to mfl-csp",
].join("; "));

export const cspReportOnlyHeaders = Object.freeze([
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
  { key: "Reporting-Endpoints", value: 'mfl-csp="/api/csp-report"' },
]);

export const outputFileTracingIncludes = {
  "/api/data": ["./api/data-files/mfl_database.db"],
  "/api/identity": ["./api/data-files/mfl_database.db"],
  "/api/operational-health": ["./api/data-files/mfl_database.db"],
  "/api/evaluation-preview": ["./index.html", "./api/data-files/mfl_database.db"],
  "/api/evaluation-share": ["./api/data-files/mfl_database.db"],
  "/api/wallet-opt-ins": ["./api/data-files/mfl_database.db"],
  "/api/wallet-preferences": ["./api/data-files/mfl_database.db"],
  "/api/evaluation-preview-image": [
    "./api/data-files/mfl_database.db",
    "./node_modules/@expo-google-fonts/titillium-web/**/*.ttf",
    "./node_modules/webp-wasm/webp_node_dec.wasm",
  ],
  "/api/progression-email-portrait": ["./node_modules/webp-wasm/webp_node_dec.wasm"],
};

export function createNextHeaders({ production = process.env.NODE_ENV === "production" } = {}) {
  return [
    { source: "/:path*", headers: production ? [...securityHeaders, ...cspReportOnlyHeaders] : securityHeaders },
    { source: "/", headers: noStore },
    { source: "/index.html", headers: noStore },
    { source: "/release.json", headers: noStore },
    ...(production
      ? [
        { source: "/:path*.js", missing: [{ type: "query", key: "mfl_core" }], headers: noStore },
        { source: "/:path*.js", has: [{ type: "query", key: "mfl_core" }], headers: immutable },
        { source: "/modules/app-core-runtime.js", has: [{ type: "query", key: "mfl_core" }], headers: immutable },
      ]
      : [{ source: "/:path*.js", headers: noStore }]),
    { source: "/:path*.css", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
  ];
}

export function createNextRewrites() {
  return {
    beforeFiles: [
      {
        source: "/evaluation",
        has: [{ type: "query", key: "share" }],
        destination: "/api/evaluation-preview",
      },
    ],
    afterFiles: [],
    fallback: [{ source: "/:path*", destination: "/index.html" }],
  };
}

const developmentWebpack = process.env.NODE_ENV !== "production"
  ? {
      webpack(config) {
        config.module.rules.push({
          test: /legacy-dev-watch-token\.js$/,
          use: [{ loader: resolve(root, "dev-legacy-watch-loader.cjs") }],
        });
        config.plugins.push(new MflLegacyDevBridgePlugin({ root }));
        return config;
      },
    }
  : {};

const nextConfig = {
  devIndicators: { position: "bottom-left" },
  env: {
    MFL_DEPLOY_COMMIT: deploymentCommit,
  },
  ...developmentWebpack,
  outputFileTracingIncludes,
  headers() {
    return createNextHeaders();
  },
  rewrites() {
    return createNextRewrites();
  },
};

export default nextConfig;
