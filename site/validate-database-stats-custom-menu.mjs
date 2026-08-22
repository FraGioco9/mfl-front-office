import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const styles = await read("./styles.css");
const runtime = await read("./database-stats-runtime.js");

const selector = "#databaseStatsPage #databaseStatsCustomFilter {";
const start = styles.indexOf(selector);
const end = styles.indexOf("\n}", start);
const panel = start >= 0 && end > start ? styles.slice(start, end + 2) : "";

invariant(start >= 0, "Database Stats Custom menu must keep a canonical static style owner.");
invariant(panel.includes("display: grid;"), "Database Stats Custom must use a compact dropdown grid.");
invariant(panel.includes("width: 220px;"), "Database Stats Custom menu must keep a stable compact width.");
invariant(panel.includes("padding: 5px;"), "Database Stats Custom menu must use the shared compact dropdown inset.");
invariant(panel.includes("border: 1px solid var(--border-strong);"), "Database Stats Custom menu must use the site's strong dropdown border.");
invariant(panel.includes("border-radius: 8px;"), "Database Stats Custom menu must use the site's dropdown corner radius.");
invariant(panel.includes("box-shadow: var(--mfl-dropdown-shadow);"), "Database Stats Custom menu must use the canonical dropdown shadow.");
invariant(!styles.includes("#databaseStatsPage #databaseStatsCustomFilter::before"), "Database Stats Custom must not retain the old tooltip arrow.");
invariant(styles.includes("#databaseStatsPage #databaseStatsCustomFilter input:hover:not(:disabled),"), "Custom range inputs must use the site's hover/focus treatment.");
invariant(styles.includes("#databaseStatsPage #databaseStatsCustomApply {\n  grid-column: 1 / -1;\n  width: 100%;\n  height: 34px;"), "Custom Apply must align with the compact dropdown controls.");
invariant(!styles.slice(start).includes("!important"), "Database Stats Custom styling must not use !important.");
invariant(runtime.includes("function positionCustomPanel() {"), "Database Stats runtime must retain its positioning owner.");
invariant(runtime.includes("closeCustomPanel({ restoreFocus: true });"), "Database Stats Custom must retain keyboard dismissal and focus restoration.");

console.log("Database Stats Custom menu style validation passed.");
