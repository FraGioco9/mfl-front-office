import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PRIMARY_DELAY_MINUTES,
  resolveDueOccurrence,
} from "./supabase/functions/mfl-database-refresh-dispatch/schedule.mjs";

test("summer UTC+2 candidate resolves the 10:20 Rome occurrence", () => {
  const occurrence = resolveDueOccurrence(new Date("2026-08-27T08:20:00Z"), "10:20");
  assert.deepEqual(occurrence, {
    occurrenceKey: "20260827-1020",
    intendedAt: "2026-08-27T10:20:00+02:00",
    delayMinutes: 0,
    localNow: "2026-08-27T10:20",
  });
});

test("inactive summer UTC candidate is ignored", () => {
  assert.equal(
    resolveDueOccurrence(new Date("2026-08-27T09:20:00Z"), "10:20"),
    null,
  );
});

test("winter UTC+1 candidate resolves without changing cron definitions", () => {
  const occurrence = resolveDueOccurrence(new Date("2026-01-15T09:20:00Z"), "10:20");
  assert.equal(occurrence?.occurrenceKey, "20260115-1020");
  assert.equal(occurrence?.intendedAt, "2026-01-15T10:20:00+01:00");
  assert.equal(occurrence?.delayMinutes, 0);
});

test("inactive winter UTC candidate is ignored", () => {
  assert.equal(
    resolveDueOccurrence(new Date("2026-01-15T08:20:00Z"), "10:20"),
    null,
  );
});

test("10-minute recovery resolves to the same occurrence", () => {
  const occurrence = resolveDueOccurrence(new Date("2026-08-27T08:30:00Z"), "10:20");
  assert.equal(occurrence?.occurrenceKey, "20260827-1020");
  assert.equal(occurrence?.intendedAt, "2026-08-27T10:20:00+02:00");
  assert.equal(occurrence?.delayMinutes, 10);
});

test("scheduler accepts the recovery window but rejects stale invocations", () => {
  assert.equal(MAX_PRIMARY_DELAY_MINUTES, 20);
  assert.equal(
    resolveDueOccurrence(new Date("2026-08-27T08:40:00Z"), "10:20")?.delayMinutes,
    20,
  );
  assert.equal(
    resolveDueOccurrence(new Date("2026-08-27T08:41:00Z"), "10:20"),
    null,
  );
});

test("a delayed 23:15 invocation just after Rome midnight resolves the prior date", () => {
  const occurrence = resolveDueOccurrence(
    new Date("2026-08-28T22:05:00Z"),
    "23:15",
    { maxDelayMinutes: 55 },
  );
  assert.equal(occurrence?.occurrenceKey, "20260828-2315");
  assert.equal(occurrence?.intendedAt, "2026-08-28T23:15:00+02:00");
  assert.equal(occurrence?.delayMinutes, 50);
});

test("unsupported refresh targets fail closed", () => {
  assert.throws(
    () => resolveDueOccurrence(new Date("2026-08-27T08:20:00Z"), "12:00"),
    /Unsupported refresh target/,
  );
});
