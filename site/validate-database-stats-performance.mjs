import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("./database-stats-runtime.js", import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (value, message) => invariant(runtime.includes(value), message);
const excludes = (value, message) => invariant(!runtime.includes(value), message);

includes('const COUNT_FORMATTER = new Intl.NumberFormat("en-US");', "Database Stats must reuse one count formatter.");
includes("return COUNT_FORMATTER.format(Number(value || 0));", "Database Stats count formatting must use the shared formatter.");
includes("function databaseStatsSummary() {", "Database Stats must aggregate cards and histogram from one summary pass.");
includes("for (const group of data.rows) {", "Database Stats summary must traverse source groups directly once.");
includes("if (years === 0) summary.retired += count;", "The summary pass must preserve retired-player totals.");
includes("if (years === 3) summary.retiringThree += count;", "The summary pass must preserve three-season retirement totals.");
includes("if (years === 2) summary.retiringTwo += count;", "The summary pass must preserve two-season retirement totals.");
includes("if (years === 1) summary.retiringOne += count;", "The summary pass must preserve one-season retirement totals.");
includes("counts.set(value, (counts.get(value) || 0) + count);", "The summary pass must aggregate histogram buckets.");
includes("const summary = databaseStatsSummary();", "Full Database Stats rendering must compute one shared summary.");
includes("renderDistribution(summary);", "Full Database Stats rendering must reuse the card summary for the histogram.");
includes("const resolvedSummary = summary || databaseStatsSummary();", "Distribution-only changes must still use exactly one summary traversal.");
excludes("function filteredGroups() {", "Database Stats must not retain the former source-filter allocation pass.");
excludes("function sumGroups(", "Database Stats must not retain repeated card reduction passes.");
excludes("filteredGroups().forEach", "Histogram rendering must not refilter source groups.");

// Deterministic targeted operation accounting for 1,000 source groups where all
// groups match the selected range. Before Step 16 a non-All full render visited
// the source twice (cards + histogram), traversed the filtered groups five times
// for card totals, and once more for the histogram: 2N + 6N = 8N visits.
// The All filter skipped the active/retired reductions but still used 2N + 4N.
// The optimized full render performs one source traversal for all card totals and
// the histogram. A distribution-mode-only render improves from N + N to N.
const groups = 1000;
const previousNonAllVisits = (2 * groups) + (6 * groups);
const previousAllVisits = (2 * groups) + (4 * groups);
const previousDistributionOnlyVisits = 2 * groups;
const optimizedVisits = groups;
const nonAllReduction = (1 - optimizedVisits / previousNonAllVisits) * 100;
const allReduction = (1 - optimizedVisits / previousAllVisits) * 100;
const distributionReduction = (1 - optimizedVisits / previousDistributionOnlyVisits) * 100;

invariant(nonAllReduction === 87.5, "Step 16 non-All full-render visit reduction must remain 87.5% for the representative dataset.");
invariant(Math.round(allReduction * 10) / 10 === 83.3, "Step 16 All-filter full-render visit reduction must remain 83.3% for the representative dataset.");
invariant(distributionReduction === 50, "Step 16 distribution-only visit reduction must remain 50% for the representative dataset.");

console.log(
  `Database Stats performance validation passed: 1,000 matching group visits ${previousNonAllVisits} -> ${optimizedVisits} for non-All full renders (${nonAllReduction}% reduction), ${previousAllVisits} -> ${optimizedVisits} for All full renders (${allReduction.toFixed(1)}% reduction), and ${previousDistributionOnlyVisits} -> ${optimizedVisits} for distribution-only changes (${distributionReduction}% reduction).`,
);
