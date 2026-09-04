import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message);
};

const [indexHtml, footer, bootstrapCore, runtime, appEntry, api, schema, migration] = await Promise.all([
  read("./index.html"),
  read("./footer.css"),
  read("./bootstrap-core.js"),
  read("./bug-report-runtime.js"),
  read("./modules/app-entry.js"),
  read("./api/bug-reports.js"),
  read("../supabase-schema.sql"),
  read("../supabase/migrations/20260904231420_create_bug_reports.sql"),
]);

includes(indexHtml, 'href="https://github.com/FraGioco9/mfl-front-office/issues/new"', "The static footer anchor must remain identifiable until guaranteed bootstrap ownership neutralizes it.");
includes(indexHtml, '>Report a bug</a>', "Footer support must expose Report a bug.");
excludes(
  footer,
  '.siteFooterDetailsGroup a[href*="/mfl-front-office/issues/new"] {\n  pointer-events: none;',
  "Report a bug must remain pointer-interactive while the in-site runtime assumes ownership.",
);

for (const token of [
  'const BUG_REPORT_CONTROL_SELECTOR =',
  'function prepareBugReportControl(control = document.querySelector(BUG_REPORT_CONTROL_SELECTOR))',
  'control.removeAttribute("href");',
  'control.removeAttribute("target");',
  'control.removeAttribute("rel");',
  'function bugReportRuntimeLoader()',
  'return resources.load("/bug-report-runtime.js");',
  'function ensureBugReportRuntime()',
  'function installBugReportBootstrap()',
  'event.preventDefault();',
  'event.stopImmediatePropagation();',
  'void ensureBugReportRuntime()\n        .then((runtime) => runtime.open())',
  'document.addEventListener("click", activate, true);',
  'document.addEventListener("keydown", activateKeyboard, true);',
  'void ensureBugReportRuntime().catch((error) => {',
  'installBugReportBootstrap();',
]) {
  includes(bootstrapCore, token, `Guaranteed bug report bootstrap contract is missing: ${token}`);
}
excludes(
  bootstrapCore,
  'if (window.__mflBugReportRuntime?.open) return;',
  "Guaranteed bug report activation must not become inert once the form runtime is already loaded.",
);
excludes(bootstrapCore, "window.open", "Guaranteed bug report bootstrap must never open GitHub or any external window.");

const controlIndex = appEntry.indexOf('"/control-interactions-runtime.js"');
const bugRuntimeIndex = appEntry.indexOf('"/bug-report-runtime.js"');
if (controlIndex < 0 || bugRuntimeIndex <= controlIndex) {
  throw new Error("Bug report runtime must remain in the universal application runtime group after global control interactions.");
}

for (const token of [
  'const REPORT_LINK_SELECTOR =',
  'const MODAL_TRANSITION_MS = 190;',
  'function ensureModal()',
  'id="bugReportSummary"',
  'id="bugReportArea"',
  'id="bugReportRoute"',
  'id="bugReportReproduction"',
  'id="bugReportExpected"',
  'id="bugReportActual"',
  'id="bugReportEnvironment"',
  'id="bugReportEvidence"',
  'return `${window.location.pathname}${window.location.search}`',
  'navigator.userAgent',
  'window.__mflReleaseVersion',
  'fetch("/api/bug-reports", {',
  'Reflect.get(window, "walletProofHeaders")',
  'target.classList.remove("modalClosing", "modalOpen");',
  'target.hidden = false;',
  'window.requestAnimationFrame(() => {\n      window.requestAnimationFrame(() => {',
  'target.classList.add("modalOpen");',
  'modal.classList.remove("modalOpen");',
  'modal.classList.add("modalClosing");',
  'modal.hidden = true;',
  'function reportControlFromTarget(target)',
  'function prepareReportControl(control)',
  'control.dataset.bugReportControl = "true";',
  'control.removeAttribute("href");',
  'control.removeAttribute("target");',
  'control.removeAttribute("rel");',
  'control.setAttribute("role", "button");',
  'control.setAttribute("aria-haspopup", "dialog");',
  'function handleDocumentClick(event)',
  'function handleDocumentKeyDown(event)',
  'document.addEventListener("click", handleDocumentClick, true);',
  'document.addEventListener("keydown", handleDocumentKeyDown, true);',
  'prepareReportControl(document.querySelector(REPORT_LINK_SELECTOR));',
  'event.stopPropagation();',
  'registerEscapeHandler?.(',
  '"bug-report",',
  '{ priority: 250 }',
  'showToast("Bug report submitted.")',
]) {
  includes(runtime, token, `Bug report runtime contract is missing: ${token}`);
}

const modalRevealOrder = [
  'target.classList.remove("modalClosing", "modalOpen");',
  'target.hidden = false;',
  'window.requestAnimationFrame(() => {\n      window.requestAnimationFrame(() => {',
  'target.classList.add("modalOpen");',
].map((token) => runtime.indexOf(token));
if (modalRevealOrder.some((index) => index < 0) || modalRevealOrder.some((index, position) => position > 0 && index <= modalRevealOrder[position - 1])) {
  throw new Error("Bug report modal must use the canonical painted closed-state frame before modalOpen makes it visible.");
}

excludes(runtime, 'reportLink.addEventListener("click"', "Bug report activation must not depend on one static footer node.");
excludes(runtime, "event.metaKey", "Bug report activation must not retain modifier-click escape to GitHub.");
excludes(runtime, "window.open", "Bug report activation must never open an external window.");

for (const token of [
  'const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;',
  'const RATE_LIMIT_MAX_REPORTS = 5;',
  'crypto.createHmac("sha256", config.key)',
  'signedWalletFromRequest(request, { warning: false })',
  'if (request.method !== "POST")',
  'response.status(413)',
  'response.status(429)',
  'supabaseRequest("bug_reports", {',
  'reporter_hash: hash',
  'user_agent: userAgent',
  'wallet_address: wallet || null',
]) {
  includes(api, token, `Bug report API contract is missing: ${token}`);
}
if (/x-forwarded-for[\s\S]{0,800}(body|JSON\.stringify)\s*[:=]/.test(api)) {
  throw new Error("Bug report API must never persist the raw forwarded IP address.");
}

for (const source of [schema, migration]) {
  for (const token of [
    'create table if not exists public.bug_reports',
    'reporter_hash text not null',
    "status text not null default 'new'",
    'bug_reports_reporter_created_idx',
    'bug_reports_status_created_idx',
    'alter table public.bug_reports enable row level security;',
    'revoke all on table public.bug_reports from anon, authenticated;',
    'grant select, insert, update, delete on table public.bug_reports to service_role;',
  ]) {
    includes(source, token, `Bug report Supabase contract is missing: ${token}`);
  }
}

for (const token of [
  '.bugReportDialog {',
  'width: min(720px, calc(100vw - 24px));',
  'max-height: min(760px, calc(100dvh - 24px));',
  'grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));',
  '.bugReportSubmitButton {',
]) {
  includes(footer, token, `Bug report popup styling is missing: ${token}`);
}
if (footer.includes("!important")) throw new Error("Bug report styling must not introduce !important overrides.");

console.log("Bug report popup and private Supabase intake validation passed with canonical visible-modal lifecycle, guaranteed direct opening, delegated in-site activation, and no external escape path.");
