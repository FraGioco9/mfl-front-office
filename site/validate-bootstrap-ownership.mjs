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
  "bootstrap.js must synchronously own first-paint loading state.",
);
includes(
  bootstrap,
  'root.classList.remove("mflInitialRouteResolved");',
  "First-paint route state must remain distinct until startup settles.",
);
includes(
  bootstrap,
  "function primeInitialShell() {",
  "bootstrap.js must immediately select the destination shell.",
);
includes(
  bootstrap,
  "function primeInitialTableChrome(page, urlLike = window.location.href) {",
  "bootstrap.js must synchronously prime table title and quickfilters.",
);
includes(
  bootstrap,
  "function primeViewButtons(page, view) {",
  "First-paint view buttons must be updated directly in the DOM.",
);
includes(
  bootstrap,
  "container.insertBefore(button, switcher instanceof HTMLElement ? switcher : null);",
  "View order must be represented by DOM order instead of CSS order overrides.",
);
includes(
  bootstrap,
  'candidate.textContent = page === "club" ? "Squad" : "Attributes";',
  "Club Squad must use real button text instead of generated pseudo-content.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflPrimeTableChrome", primeInitialTableChrome);',
  "Runtime navigation must reuse the bootstrap-owned table chrome primer.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflTableTitleForPageFallback", firstPaintTableTitle);',
  "Player-only startup must retain a shared table-title fallback.",
);
includes(
  bootstrap,
  "function primeInitialTableRows(replaceExisting = false) {",
  "bootstrap.js must seed table routes with five rows before data arrives.",
);
includes(
  bootstrap,
  "const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];",
  "Initial table loading must retain exactly five blank rows.",
);
includes(
  bootstrap,
  "function primeRouteSkeleton(target) {",
  "Non-table routes must have an immediate static skeleton owner.",
);
includes(
  bootstrap,
  "function primePlayerSkeleton() {",
  "Player navigation must reveal structural boxes before player data resolves.",
);
includes(
  bootstrap,
  "function resetStatsShell(target) {",
  "Stats navigation must reset destination boxes before data resolves.",
);
excludes(
  bootstrap,
  'document.createElement("style")',
  "First-paint bootstrap must not patch layout through injected styles.",
);
excludes(
  bootstrap,
  "!important",
  "First-paint bootstrap must not use CSS overrides.",
);

excludes(
  bootstrapCore,
  'document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");',
  "bootstrap-core.js must not duplicate bootstrap.js first-paint ownership.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.remove("mflSingleRenderPending");',
  "bootstrap-core.js must release first-paint loading state when startup finishes.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.add("mflInitialRouteResolved");',
  "Runtime route ownership must begin only after startup settles.",
);
includes(
  bootstrapCore,
  "if (startupFinished) return;",
  "Startup cleanup must be idempotent across success and error paths.",
);
includes(
  bootstrapCore,
  'if (document.documentElement.dataset.mflReady === "error")',
  "The bootstrap busy controller must observe actual startup failures.",
);
includes(
  bootstrapCore,
  "const recoverCompletedApplicationStartup = async () => {",
  "Post-core errors must be classified against the application startup promise.",
);
includes(
  bootstrapCore,
  "await appStartPromise;",
  "A post-core error must keep loading active until the application promise settles.",
);
excludes(
  bootstrapCore,
  "Promise.race([",
  "Post-core recovery must not use a short timeout that can misclassify slow successful loading.",
);
includes(
  bootstrapCore,
  'document.getElementById("mflStartupError")?.remove();',
  "A recovered post-core error must remove its false fatal message.",
);
excludes(
  bootstrapCore,
  "!important",
  "The bootstrap busy controller must not depend on CSS priority overrides.",
);

console.log("Bootstrap direct first-paint skeleton and startup ownership validation passed.");
