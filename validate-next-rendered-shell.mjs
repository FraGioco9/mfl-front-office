import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [packageSource, documentSource, pageSource, homeSource, nextConfig, eslintSource] = await Promise.all([
  read("./package.json"),
  read("./pages/_document.js"),
  read("./pages/[...path].js"),
  read("./pages/index.js"),
  read("./next.config.mjs"),
  read("./eslint.config.mjs"),
]);

const packageJson = JSON.parse(packageSource);
invariant(
  packageJson.dependencies?.["html-react-parser"] === "6.1.7",
  "Next-rendered shell must pin html-react-parser 6.1.7.",
);
invariant(
  documentSource.includes('readFileSync(INDEX_PATH, "utf8")')
    && documentSource.includes("React.createElement(Main)")
    && documentSource.includes("React.createElement(NextScript)")
    && documentSource.includes("legacy.bodyChildren"),
  "Custom Next Document must render the canonical legacy shell as document-owned nodes plus the Next page/client mounts.",
);
invariant(
  documentSource.includes('parse(head[2])') && documentSource.includes('parse(body[2])'),
  "Custom Next Document must derive both head and body from the canonical generated index.html.",
);
invariant(
  homeSource.includes("export default function MflHomePage()") && homeSource.includes("return null;"),
  "Home must be a concrete Next page so development tooling has a canonical root route.",
);
invariant(
  pageSource.includes("export function getServerSideProps()")
    && pageSource.includes("return { props: {} };"),
  "Deep-route catch-all must remain server-resolved so direct production requests cannot be statically optimized into Vercel 404s.",
);
invariant(
  pageSource.includes("export default function MflLegacyShellRoutePage()")
    && pageSource.includes("return null;"),
  "Required deep-route Next page must remain an empty framework mount while legacy UI ownership is migrated incrementally.",
);
invariant(
  nextConfig.includes('devIndicators: { position: "bottom-left" }'),
  "Next development indicator must stay explicitly enabled at the canonical bottom-left position.",
);
invariant(
  nextConfig.includes('has: [{ type: "query", key: "share" }]'),
  "Only shared Evaluation preview requests may bypass the rendered Next shell.",
);
invariant(
  eslintSource.includes('"pages/*.js", "pages/api/**/*.js"'),
  "Next page shell files must remain inside canonical lint ownership.",
);

console.log("Next-rendered legacy document bridge validation passed.");
