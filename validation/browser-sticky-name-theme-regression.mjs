// Historical CLI retained until all external consumers are accounted for.
process.argv.splice(2, Infinity, "sticky-name-theme");
await import("./browser-responsive-contract-runner.mjs");
