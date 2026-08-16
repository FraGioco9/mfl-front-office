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
  "const recoverCompletedApplicationStartup = async () => {",
  "Late startup errors must be classified against the actual application-core startup result.",
);
includes(
  bootstrapCore,
  "applicationStarted = await Promise.race([",
  "Non-fatal startup recovery must be bounded instead of waiting indefinitely.",
);
includes(
  bootstrapCore,
  "window.setTimeout(() => resolve(false), 250)",
  "Late startup recovery must have a short timeout ceiling.",
);
includes(
  bootstrapCore,
  'document.getElementById("mflStartupError")?.remove();',
  "A false fatal startup message must be removed when the application core completed successfully.",
);
includes(
  bootstrapCore,
  'document.documentElement.dataset.mflReady = "true";',
  "Recovered application startup must restore the normal ready state.",
);
includes(
  bootstrapCore,
  "await finishStartup({ skipAppStart: true });",
  "A real startup failure must release the bootstrap lock without awaiting a failed or stuck app promise.",
);

console.log("Bootstrap single-render ownership validation passed.");
