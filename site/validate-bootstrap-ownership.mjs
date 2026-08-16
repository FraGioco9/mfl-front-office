import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [bootstrap, bootstrapCore] = await Promise.all([
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
]);

includes(
  bootstrap,
  'document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");',
  "bootstrap.js must synchronously own the first-paint route lock.",
);
includes(
  bootstrap,
  'style.id = "mflSingleRenderPendingStyles";',
  "bootstrap.js must synchronously own the first-paint hiding style.",
);
includes(
  bootstrap,
  'style.textContent = "html.mflSingleRenderPending main > .pageView { visibility: hidden !important; }";',
  "bootstrap.js must install the canonical first-paint hiding rule.",
);

excludes(
  bootstrapCore,
  'document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");',
  "bootstrap-core.js must not duplicate bootstrap.js first-paint lock ownership.",
);
excludes(
  bootstrapCore,
  'singleRenderStyle = document.createElement("style");',
  "bootstrap-core.js must not duplicate bootstrap.js first-paint style creation.",
);
includes(
  bootstrapCore,
  'const singleRenderStyle = document.getElementById("mflSingleRenderPendingStyles");',
  "bootstrap-core.js must reference the bootstrap-owned first-paint style for cleanup.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.remove("mflSingleRenderPending");',
  "bootstrap-core.js must release the first-paint route lock when startup finishes.",
);
includes(
  bootstrapCore,
  "singleRenderStyle?.remove();",
  "bootstrap-core.js must remove the bootstrap-owned first-paint style when startup finishes.",
);
includes(
  bootstrapCore,
  "if (startupFinished) return;",
  "Startup cleanup must be idempotent across success and error completion paths.",
);
includes(
  bootstrapCore,
  'if (document.documentElement.dataset.mflReady === "error")',
  "The bootstrap busy controller must observe application startup failures.",
);
includes(
  bootstrapCore,
  'startupStateObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mfl-ready"] });',
  "Application startup failure state must release the bootstrap-owned busy token.",
);
includes(
  bootstrapCore,
  'if (document.documentElement.dataset.mflReady !== "error" && window.__mflAppStartPromise)',
  "Startup failure cleanup must release immediately without awaiting a failed or stuck application promise.",
);

console.log("Bootstrap single-render ownership validation passed.");
