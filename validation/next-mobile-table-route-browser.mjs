import { runNextMobileTableProbe } from "./next-mobile-table-browser.mjs";

// Historical CLI retained: external callers remain unknown.
await runNextMobileTableProbe("routes", process.argv[2]);
