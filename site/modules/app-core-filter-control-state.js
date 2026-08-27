// @ts-check

import { replaceRequiredFunction } from "./app-core-splitter-utils.js";

export function addActiveFilterControlState(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const core = String(input.core || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot add active Filters control state to an empty application core.");
  }

  const normalizedCore = replaceRequiredFunction(
    core,
    "updateFilterSummary",
    `function updateFilterSummary(count = activeFilterCount()) {
  const numericCount = Number(count);
  const normalizedCount = Number.isFinite(numericCount) ? Math.max(0, Math.trunc(numericCount)) : 0;
  const active = normalizedCount >= 1;
  filterSummary.textContent = String(normalizedCount);
  filterSummary.classList.toggle("hasActiveFilters", active);
  openFiltersButton?.classList.toggle("hasActiveFilters", active);
}`,
    "Active Filters count and highlighted state",
  );

  return Object.freeze({ ...input, core: normalizedCore });
}
