const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0" }];
const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

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
      { source: "/evaluation", destination: "/api/evaluation-preview" },
    ],
    afterFiles: [],
    fallback: [{ source: "/:path*", destination: "/index.html" }],
  };
}

const nextConfig = {
  outputFileTracingIncludes,
  headers() {
    return createNextHeaders();
  },
  rewrites() {
    return createNextRewrites();
  },
};

export default nextConfig;
