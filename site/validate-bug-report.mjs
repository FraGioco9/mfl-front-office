import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message);
};

const [indexHtml, footer, bootstrapCore, runtime, controlInteractions, appEntry, api, schema, migration] = await Promise.all([
  read("./index.html"),
  read("./footer.css"),
  read("./bootstrap-core.js"),
  read("./bug-report-runtime.js"),
  read("./control-interactions-runtime.js"),
  read("./modules/app-entry.js"),
  read("./api/bug-reports.js"),
  read("../supabase-schema.sql"),
  read("../supabase/migrations/20260904231420_create_bug_reports.sql"),
]);

includes(indexHtml, 'href="https://github.com/FraGioco9/mfl-front-office/issues/new"', "The legacy static footer anchor must remain identifiable until bootstrap neutralizes external navigation.");
includes(indexHtml, '>Report a bug</a>', "Footer support must expose Report a bug.");
excludes(
  footer,
  '.siteFooterDetailsGroup a[href*="/mfl-front-office/issues/new"] {\n  pointer-events: none;',
  "Report a bug must remain pointer-interactive while the in-site runtime assumes ownership.",
);

for (const token of [
  'const BUG_REPORT_CONTROL_SELECTOR =',
  'function prepareBugReportControl(control = document.querySelector(BUG_REPORT_CONTROL_SELECTOR))',
  'control.dataset.bugReportControl = "true";',
  'control.removeAttribute("href");',
  'control.removeAttribute("target");',
  'control.removeAttribute("rel");',
  'control.setAttribute("role", "button");',
  'control.setAttribute("aria-haspopup", "dialog");',
  'control.setAttribute("aria-controls", "bugReportModal");',
  'prepareBugReportControl();',
]) {
  includes(bootstrapCore, token, `Early bug report neutralization contract is missing: ${token}`);
}
for (const forbidden of [
  'function bugReportControlFromTarget(',
  'function bugReportRuntimeLoader()',
  'function ensureBugReportRuntime()',
  'async function openBugReportForm()',
  'function installBugReportBootstrap()',
  'resources.load("/bug-report-runtime.js")',
  'void openBugReportForm()',
]) {
  excludes(bootstrapCore, forbidden, `Bootstrap must not own bug-report activation or runtime loading: ${forbidden}`);
}
excludes(bootstrapCore, "window.open", "Bootstrap must never open GitHub or any external window for bug reports.");

const controlIndex = appEntry.indexOf('"/control-interactions-runtime.js"');
const bugRuntimeIndex = appEntry.indexOf('"/bug-report-runtime.js"');
if (controlIndex < 0 || bugRuntimeIndex <= controlIndex) {
  throw new Error("Bug report runtime must remain in the universal application runtime group after global control interactions.");
}

for (const token of [
  'const REPORT_CONTROL_SELECTOR =',
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
  'window.addEventListener("keydown", handleEscape, true);',
  'prepareReportControl(document.querySelector(REPORT_CONTROL_SELECTOR));',
  'event.stopImmediatePropagation();',
  'target.classList.remove("modalClosing");',
  'target.hidden = false;',
  'target.classList.add("modalOpen");',
  'modal.classList.remove("modalOpen");',
  'modal.classList.add("modalClosing");',
  'showToast("Bug report submitted.")',
]) {
  includes(runtime, token, `Bug report runtime contract is missing: ${token}`);
}

const runtimeOpenStart = runtime.indexOf("function openModal()");
const runtimeCloseStart = runtime.indexOf("function closeModal(");
const runtimeOpenSection = runtime.slice(runtimeOpenStart, runtimeCloseStart);
const visibleIndex = runtimeOpenSection.indexOf('target.hidden = false;');
const openClassIndex = runtimeOpenSection.indexOf('target.classList.add("modalOpen");');
const prefillIndex = runtimeOpenSection.indexOf('prefillContext();');
const tooltipIndex = runtimeOpenSection.indexOf('window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });');
if (
  runtimeOpenStart < 0
  || runtimeCloseStart <= runtimeOpenStart
  || visibleIndex < 0
  || openClassIndex <= visibleIndex
  || (prefillIndex >= 0 && prefillIndex < openClassIndex)
  || (tooltipIndex >= 0 && tooltipIndex < openClassIndex)
) {
  throw new Error("Bug report runtime must make the modal synchronously visible before optional context or tooltip work.");
}

for (const forbidden of [
  'reportLink.addEventListener("click"',
  'registerEscapeHandler?.(',
  'event.metaKey',
  'window.open',
]) {
  excludes(runtime, forbidden, `Bug report runtime retains a forbidden secondary activation/dependency path: ${forbidden}`);
}

for (const token of [
  'function bugReportModalOwnsKeyboard(target)',
  'document.getElementById("bugReportModal")',
  '!bugReportModalOwnsKeyboard(event.target)',
]) {
  includes(controlInteractions, token, `Global modal keyboard handling must yield to the bug-report form: ${token}`);
}

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

console.log("Bug report popup and private Supabase intake validation passed with bootstrap-only URL neutralization, one runtime activation owner, synchronous modal visibility, form-owned keyboard input, and no external escape path.");
