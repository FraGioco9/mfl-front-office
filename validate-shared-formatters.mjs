import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreSource, canonicalCoreDomains } from "./validate-core-sources.mjs";

const read = path => readValidationText(path, import.meta.url);
const shared = readCanonicalCoreSource("shared");
const routeSources = Object.entries(canonicalCoreDomains).filter(([domain]) => domain !== "shared");
const [databaseStats, planner, docs] = await Promise.all([
  read("./database-stats-runtime.js"),
  read("./modules/core-sources/planner.js"),
  read("./docs/shared-formatters.md"),
]);

const sharedFormatterOwners = [
  "formatCount",
  "normalizeSettingsDateFormat",
  "dateFormatLabel",
  "normalizeSettingsTimeFormat",
  "formatOwnedSinceTime",
  "formatOwnedSinceDate",
  "contractDivisionInfo",
  "formatContractPercentage",
  "formatContractRevenueShare",
  "formatContractClubName",
  "formatContractDivision",
  "playerPositions",
  "formatDecimal",
  "formatRoundedUpDecimal",
];

for (const name of sharedFormatterOwners) {
  invariant(
    shared.includes(`function ${name}(`),
    `ARCH-05 shared formatter owner must remain in Shared: ${name}.`,
  );
  for (const [domain, source] of routeSources) {
    invariant(
      !source.includes(`function ${name}(`),
      `Route domain ${domain} must not duplicate Shared formatter owner ${name}.`,
    );
  }
}

invariant(
  databaseStats.includes('function formatCount(value) {\n    return new Intl.NumberFormat("en-US").format(Number(value || 0));')
    && docs.includes("Database Stats exception"),
  "Database Stats keeps its pre-core zero-safe count formatter as an explicit lifecycle exception.",
);

invariant(
  planner.includes("function plannerPlanUpdatedLabel(value)")
    && planner.includes('new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"})')
    && docs.includes("Planner exception"),
  "Planner saved-plan timestamps must remain a route-specific locale date+time contract.",
);

const routeIntlDateOwners = routeSources
  .filter(([, source]) => source.includes("Intl.DateTimeFormat"))
  .map(([domain]) => domain);
invariant(
  routeIntlDateOwners.length === 1 && routeIntlDateOwners[0] === "planner",
  `Only Planner may own a route-specific Intl.DateTimeFormat contract; found: ${routeIntlDateOwners.join(", ") || "none"}.`,
);

invariant(
  docs.includes("NO CHANGE runtime")
    && docs.includes("Do not unify by name alone"),
  "ARCH-05 must document why formatter promotion is semantic, not name-based.",
);

console.log("ARCH-05 shared formatter ownership and scoped-exception validation passed.");
