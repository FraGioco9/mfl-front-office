import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MflLegacyDevBridgePlugin } from "./next-dev-legacy-bridge.mjs";

const root = dirname(fileURLToPath(import.meta.url));

const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0" }];
const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

export const securityHeaders = Object.freeze([
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
]);

export const outputFileTracingIncludes = {
  "/api/data": ["./api/data-files/mfl_database.db"],
  "/api/identity": ["./api/data-files/mfl_database.db"],
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
    { source: "/:path*", headers: securityHeaders },
    { source: "/", headers: noStore },
    { source: "/index.html", headers: noStore },
    { source: "/release.json", headers: noStore },
    { source: "/releases.json", headers: noStore },
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
      { source: "/releases.json", destination: "/api/releases" },
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
    MFL_DEPLOY_COMMIT: String(process.env.MFL_DEPLOY_COMMIT || "").trim(),
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
