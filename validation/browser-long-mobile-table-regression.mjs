// Historical CLI kept because external callers have not been ruled out.
process.env.MFL_BROWSER_RESPONSIVE_COMPAT_MODE = "long-mobile-table";
await import("./browser-responsive-contract-runner.mjs");
