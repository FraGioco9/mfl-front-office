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
  'root.classList.add("mflSingleRenderPending");',
  "bootstrap.js must synchronously own the first-paint loading shell state.",
);
includes(
  bootstrap,
  'root.classList.remove("mflInitialRouteResolved");',
  "First-paint route styles must stay authoritative until startup settles.",
);
includes(
  bootstrap,
  'style.id = "mflSingleRenderPendingStyles";',
  "bootstrap.js must synchronously style the loading shell.",
);
excludes(
  bootstrap,
  "main > .pageView { visibility: hidden !important; }",
  "Startup must not hide the destination page shell while data loads.",
);
includes(
  bootstrap,
  "function primeInitialShell() {",
  "bootstrap.js must immediately select the destination shell.",
);
includes(
  bootstrap,
  "function primeInitialTableChrome(page, urlLike = window.location.href) {",
  "bootstrap.js must synchronously prime table title, quickfilters, and pager before first paint.",
);
includes(
  bootstrap,
  "window.__mflPrimeTableChrome = primeInitialTableChrome;",
  "Runtime navigation must reuse the bootstrap-owned destination table chrome primer.",
);
includes(
  bootstrap,
  'title.textContent = firstPaintTableTitle(normalizedPage, urlLike);',
  "The destination table title must be correct before its shell is revealed.",
);
includes(
  bootstrap,
  'hideMflPlayersFilter.hidden = normalizedPage !== "database";',
  "Database-only quickfilters must be correct before first paint.",
);
includes(
  bootstrap,
  'packablePlayersFilter.hidden = normalizedPage !== "mfl";',
  "MFL-only quickfilters must be correct before first paint.",
);
includes(
  bootstrap,
  'newMintsLabel.textContent = normalizedPage === "mfl" ? "Only aged players" : "Only new mints";',
  "The MFL quickfilter label must be correct before first paint.",
);
includes(
  bootstrap,
  "if (pager instanceof HTMLElement) pager.hidden = true;",
  "The table pager must be hidden before the first loading shell is revealed.",
);
includes(
  bootstrap,
  "function primeInitialTableRows() {",
  "bootstrap.js must seed table routes with static blank rows before the core loads.",
);
includes(
  bootstrap,
  'row.className = "staticTableBlankRow";',
  "Initial table loading must use the canonical five-row placeholder class.",
);
includes(
  bootstrap,
  "const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];",
  "Initial table loading must retain exactly five blank rows.",
);

excludes(
  bootstrapCore,
  'document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");',
  "bootstrap-core.js must not duplicate bootstrap.js first-paint ownership.",
);
includes(
  bootstrapCore,
  'const singleRenderStyle = document.getElementById("mflSingleRenderPendingStyles");',
  "bootstrap-core.js must reference the bootstrap-owned loading-shell style for cleanup.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.remove("mflSingleRenderPending");',
  "bootstrap-core.js must release the loading-shell state when startup finishes.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.add("mflInitialRouteResolved");',
  "Runtime route ownership must replace first-paint route ownership only after startup settles.",
);
includes(
  bootstrapCore,
  "singleRenderStyle?.remove();",
  "bootstrap-core.js must remove the bootstrap-owned loading-shell style when startup finishes.",
);
includes(
  bootstrapCore,
  "if (startupFinished) return;",
  "Startup cleanup must be idempotent across success and error completion paths.",
);
includes(
  bootstrapCore,
  'if (document.documentElement.dataset.mflReady === "error")',
  "The bootstrap busy controller must observe actual application startup failures.",
);
includes(
  bootstrapCore,
  "const recoverCompletedApplicationStartup = async () => {",
  "Post-core startup errors must be classified against the application shell handshake.",
);
includes(
  bootstrapCore,
  "await appStartPromise;",
  "A post-core error must keep the visible loading shell active until the application promise settles.",
);
excludes(
  bootstrapCore,
  "Promise.race([",
  "Post-core recovery must not misclassify slow successful data loading with a short race timeout.",
);
excludes(
  bootstrapCore,
  "window.setTimeout(() => resolve(false), 250)",
  "The obsolete 250ms false-failure cutoff must stay removed.",
);
includes(
  bootstrapCore,
  'document.getElementById("mflStartupError")?.remove();',
  "A post-core startup error must not leave a false fatal message after the shell settles.",
);
includes(
  bootstrapCore,
  "function ensureFatalStartupMessage() {",
  "Failures before the application-core handshake must still have a real fatal message owner.",
);

console.log("Bootstrap visible-shell, first-paint table chrome, and startup-error ownership validation passed.");
