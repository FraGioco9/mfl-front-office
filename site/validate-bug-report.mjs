import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message);
};

const [indexHtml, footer, controls, bootstrapCore, runtime, controlInteractions, appEntry, api, schema, migration] = await Promise.all([
  read("./index.html"),
  read("./footer.css"),
  read("./controls.css"),
  read("./bootstrap-core.js"),
  read("./bug-report-runtime.js"),
  read("./control-interactions-runtime.js"),
  read("./modules/app-entry.js"),
  read("./api/bug-reports.js"),
  read("../supabase-schema.sql"),
  read("../supabase/migrations/20260904231420_create_bug_reports.sql"),
]);

includes(
  indexHtml,
  '<button type="button" class="siteFooterDetailsSupportButton agentTableLink" data-bug-report-control="true" aria-haspopup="dialog" aria-controls="bugReportModal">Report a bug</button>',
  "Footer support must expose Report a bug as a native in-site button from first paint.",
);
excludes(indexHtml, "mfl-front-office/issues/new", "The footer must not retain the removed external bug-report fallback path.");
excludes(runtime, "mfl-front-office/issues/new", "Bug-report runtime must not retain the removed external fallback selector.");

for (const forbidden of [
  'const BUG_REPORT_CONTROL_SELECTOR =',
  'function prepareBugReportControl(',
  'prepareBugReportControl();',
  'control.removeAttribute("href");',
  'function bugReportControlFromTarget(',
  'function bugReportRuntimeLoader()',
  'function ensureBugReportRuntime()',
  'async function openBugReportForm()',
  'function installBugReportBootstrap()',
  'resources.load("/bug-report-runtime.js")',
  'void openBugReportForm()',
]) {
  excludes(bootstrapCore, forbidden, `Bootstrap must not mutate, activate, or load the bug-report control: ${forbidden}`);
}
excludes(bootstrapCore, "window.open", "Bootstrap must never open an external window for bug reports.");

const staticUiIndex = appEntry.indexOf('"/static-ui-runtime.js"');
const bugRuntimeIndex = appEntry.indexOf('"/bug-report-runtime.js"');
const controlIndex = appEntry.indexOf('"/control-interactions-runtime.js"');
if (staticUiIndex < 0 || bugRuntimeIndex <= staticUiIndex || controlIndex <= bugRuntimeIndex) {
  throw new Error("Bug report runtime must load after static UI but before global control interactions so its capture owner is installed first.");
}

for (const token of [
  'const REPORT_CONTROL_SELECTOR = \' .siteFooterDetails [data-bug-report-control="true"]\';'.replace("' .", "'."),
  'function ensureModal()',
  '<span id="bugReportTitleLabel">Title</span>',
  'id="bugReportTitleInput" type="text" maxlength="120" autocomplete="off" required aria-labelledby="bugReportTitleLabel"',
  '<span id="bugReportRouteLabel">Route or page</span>',
  'id="bugReportRoute" type="text" maxlength="300" autocomplete="off" required aria-labelledby="bugReportRouteLabel"',
  '<span id="bugReportDescriptionLabel">Description</span>',
  'id="bugReportDescription" maxlength="4000" required aria-labelledby="bugReportDescriptionLabel"',
  '<button id="cancelBugReportButton" type="button">Cancel</button>',
  '<button id="submitBugReportButton" type="submit">Submit</button>',
  'return `${window.location.pathname}${window.location.search}`',
  'window.__mflReleaseVersion',
  'title: fieldValue("bugReportTitleInput")',
  'route: fieldValue("bugReportRoute")',
  'description: fieldValue("bugReportDescription")',
  'fetch("/api/bug-reports", {',
  'Reflect.get(window, "walletProofHeaders")',
  'function reportControlFromTarget(target)',
  'function prepareReportControl(control)',
  'control.dataset.bugReportControl = "true";',
  'control.setAttribute("aria-haspopup", "dialog");',
  'control.setAttribute("aria-controls", "bugReportModal");',
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
  'let backdropPointerStarted = false;',
  'modal.addEventListener("pointerdown", (event) => {',
  'const shouldCloseFromBackdrop = event.target === modal && backdropPointerStarted;',
  'if (shouldCloseFromBackdrop) closeModal({ reset: true });',
  'function closeModal({ reset = true } = {})',
  'if (form instanceof HTMLFormElement) form.reset();',
  'closeModal({ reset: true });',
]) {
  includes(runtime, token, `Bug report runtime contract is missing: ${token}`);
}

for (const forbidden of [
  '<label class="field">',
  '<select',
  'bugReportArea',
  'bugReportReproduction',
  'bugReportExpected',
  'bugReportActual',
  'bugReportEnvironment',
  'bugReportEvidence',
  'AREA_OPTIONS',
  'navigator.userAgent',
  'bugReportSubmitButton',
]) {
  excludes(runtime, forbidden, `Bug report popup must remain limited to Title, Route or page, Description, Cancel, and Submit: ${forbidden}`);
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
  'const title = normalizedRequired(data.title ?? data.summary, "Title", 120);',
  'const route = normalizedRequired(data.route, "Route or page", 300);',
  'data.description ?? data.actual ?? data.actualBehavior ?? data.reproduction',
  '"Description",',
  'summary: title,',
  'area: "Other",',
  'reproduction: description,',
  'expected_behavior: "Not specified.",',
  'actual_behavior: description.slice(0, 2000),',
  'supabaseRequest("bug_reports", {',
  'reporter_hash: hash',
  'user_agent: userAgent',
  'wallet_address: wallet || null',
]) {
  includes(api, token, `Bug report API contract is missing: ${token}`);
}
excludes(api, "AREA_OPTIONS", "The simplified bug-report API must not retain a public Area/dropdown contract.");
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
  '.siteFooterDetailsSupportButton {',
  'appearance: none;',
  'color: var(--text);',
  '.siteFooterDetailsSupportButton:hover:not(:disabled),\n.siteFooterDetailsSupportButton:focus-visible:not(:disabled) {',
  'background: transparent;',
  '.bugReportDialog {',
  'width: min(620px, calc(100vw - 24px));',
  'grid-template-columns: minmax(0, 1fr);',
  '.bugReportBody input,\n.bugReportBody textarea {',
  '.bugReportBody textarea {',
  'background: var(--surface);',
  'border: 1px solid var(--border-strong);',
  'padding: 11px;',
  'font-size: 13px;',
  'line-height: 1.3;',
]) {
  includes(footer, token, `Bug report popup styling is missing: ${token}`);
}

for (const token of [
  '.bugReportBody input,\n.bugReportBody textarea,\n.filtersDialog [data-filter-value],',
  '.bugReportBody input:hover:not(:disabled),',
  '.bugReportBody input:focus:not(:disabled),',
  '.bugReportBody textarea:hover:not(:disabled),',
  '.bugReportBody textarea:focus:not(:disabled),',
  'border-color: var(--primary-hover);',
  'background: var(--row-hover);',
  'box-shadow: none;',
]) {
  includes(controls, token, `Bug report boxes must reuse the canonical control highlight contract: ${token}`);
}
excludes(footer, '.siteFooterDetailsSupportButton:hover:not(:disabled),\n.siteFooterDetailsSupportButton:focus-visible:not(:disabled) {\n  border-color: transparent;\n  background: transparent;\n  color:', "Footer trigger must leave text-color highlighting to the shared agentTableLink contract.");

for (const forbidden of [
  '.bugReportBody select',
  '.bugReportSubmitButton',
  'grid-template-columns: repeat(auto-fit',
]) {
  excludes(footer, forbidden, `Bug report popup must use the shared field/button system without the removed specialized control styling: ${forbidden}`);
}
if (footer.includes("!important")) throw new Error("Bug report styling must not introduce !important overrides.");

console.log("Bug report popup validation passed with shared agent-link-only footer highlighting, reset-on-close behavior, drag-safe backdrop closing, canonical box highlighting/backgrounds, compact Description typography/padding, click-only field focus, and no external fallback path.");
