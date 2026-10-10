// Historical CLI retained until all external consumers are accounted for.
process.argv.splice(2, Infinity, "long-mobile-table");
await import("./browser-responsive-contract-runner.mjs");
