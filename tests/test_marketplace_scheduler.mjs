import assert from "node:assert/strict";
import test from "node:test";

import {
  modeForTarget,
  resolveDueOccurrence,
} from "../supabase/functions/mfl-marketplace-dispatch/schedule.mjs";

test("04:00 is the only complete Marketplace refresh", () => {
  assert.equal(modeForTarget("04:00"), "reconcile");
  for (const target of ["00:00", "03:45", "04:15", "12:30", "23:45"]) {
    assert.equal(modeForTarget(target), "incremental");
  }
});

test("only quarter-hour targets are accepted", () => {
  assert.throws(() => modeForTarget("04:05"), RangeError);
  assert.throws(() => modeForTarget("24:00"), RangeError);
  assert.throws(() => modeForTarget("invalid"), RangeError);
});

test("CEST quarter-hour occurrence keeps Rome time and offset", () => {
  const occurrence = resolveDueOccurrence(new Date("2026-08-27T03:15:00Z"), "05:15");
  assert.equal(occurrence?.occurrenceKey, "20260827-0515-p0200");
  assert.equal(occurrence?.intendedAt, "2026-08-27T05:15:00+02:00");
  assert.equal(occurrence?.delayMinutes, 0);
  assert.equal(occurrence?.mode, "incremental");
});

test("04:05 recovery resolves the 04:00 complete refresh", () => {
  const occurrence = resolveDueOccurrence(new Date("2026-08-27T02:05:00Z"), "04:00");
  assert.equal(occurrence?.occurrenceKey, "20260827-0400-p0200");
  assert.equal(occurrence?.delayMinutes, 5);
  assert.equal(occurrence?.mode, "reconcile");
});

test("fall-back repeated Rome quarter-hours get distinct occurrence keys", () => {
  const summerOffset = resolveDueOccurrence(new Date("2026-10-25T00:15:00Z"), "02:15");
  const winterOffset = resolveDueOccurrence(new Date("2026-10-25T01:15:00Z"), "02:15");
  assert.equal(summerOffset?.occurrenceKey, "20261025-0215-p0200");
  assert.equal(winterOffset?.occurrenceKey, "20261025-0215-p0100");
  assert.notEqual(summerOffset?.occurrenceKey, winterOffset?.occurrenceKey);
});

test("stale scheduler invocations fail closed", () => {
  const occurrence = resolveDueOccurrence(new Date("2026-08-27T03:26:00Z"), "05:15");
  assert.equal(occurrence, null);
});
