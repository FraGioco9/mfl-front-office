import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [stacking, base, styles, dropdowns, responsive, loading] = await Promise.all([
  read("./stacking.css"), read("./styles-base.css"), read("./styles.css"),
  read("./dropdowns.css"), read("./responsive.css"), read("./loading.css"),
]);

for (const token of [
  "--mfl-z-navigation: 15;", "--mfl-z-navigation-mobile: 18;", "--mfl-z-dropdown: 20;",
  "--mfl-z-wallet-guard: 34;", "--mfl-z-modal: 50;", "--mfl-z-floating-tooltip: 10030;",
  "--mfl-z-chrome: 2147483000;", "--mfl-z-selection: 2147483630;", "--mfl-z-toast: 2147483635;",
  "--mfl-z-critical-modal: 2147483645;", "--mfl-z-busy-shield: 2147483646;", "--mfl-z-topmost: 2147483647;",
]) invariant(stacking.includes(token), `Global stacking contract is missing ${token}`);

invariant(base.startsWith('@import url("/stacking.css");'), "Base styles must load the canonical stacking contract before site layers consume it.");
for (const required of [
  "z-index: var(--mfl-z-wallet-guard);", "z-index: var(--mfl-z-chrome);",
  "z-index: var(--mfl-z-navigation);", "z-index: var(--mfl-z-modal);",
  "z-index: var(--mfl-z-selection);", "z-index: var(--mfl-z-floating-tooltip);",
  "z-index: var(--mfl-z-critical-modal);", "z-index: var(--mfl-z-topmost);",
]) invariant(base.includes(required), `Base stacking consumer is missing ${required}`);

invariant(styles.includes("z-index: var(--mfl-z-topmost);"), "Global tooltip must consume the topmost stacking level.");
invariant(styles.includes("z-index: var(--mfl-z-chrome);"), "Database Stats popover must consume the shared chrome stacking level.");
invariant(dropdowns.match(/z-index: var\(--mfl-z-dropdown\);/g)?.length === 2, "Account and Watchlist dropdowns must share one global dropdown level.");
invariant(responsive.includes("z-index: var(--mfl-z-navigation-mobile);"), "Mobile navigation must consume the mobile navigation level.");
invariant(loading.includes("z-index: var(--mfl-z-busy-shield);"), "Interaction shield must consume the busy-shield level.");
invariant(loading.includes("z-index: var(--mfl-z-toast);"), "Normal toasts must consume the global toast level.");
invariant(loading.includes("z-index: var(--mfl-z-topmost);"), "Loading toast must consume the topmost level.");

const toastStart = base.indexOf(".toastMessage {");
const toastEnd = base.indexOf("}", toastStart);
const baseToast = base.slice(toastStart, toastEnd);
invariant(toastStart >= 0 && !baseToast.includes("z-index:"), "Base toast styling must not duplicate the effective toast stacking owner in loading.css.");

const globalOwners = [base, styles, dropdowns, responsive, loading].join("\n");
for (const literal of [
  "z-index: 10030;", "z-index: 2147483000;", "z-index: 2147483630;",
  "z-index: 2147483635;", "z-index: 2147483645;", "z-index: 2147483646;", "z-index: 2147483647;",
]) invariant(!globalOwners.includes(literal), `Cross-site stacking owner must not reintroduce raw ${literal}`);

console.log("Global z-index ownership validation passed: cross-site layers use one canonical stacking contract while component-local stacks remain local.");
