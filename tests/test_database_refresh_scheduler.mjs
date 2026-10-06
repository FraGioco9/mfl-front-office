import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

import {
  MAX_PRIMARY_DELAY_MINUTES,
  existingRunForOccurrence,
  resolveDueOccurrence,
} from "../supabase/functions/mfl-database-refresh-dispatch/schedule.mjs";

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

test("a delayed 23:03 invocation just after Rome midnight resolves the prior date", () => {
  const occurrence = resolveDueOccurrence(
    new Date("2026-08-28T22:05:00Z"),
    "23:03",
    { maxDelayMinutes: 65 },
  );
  assert.equal(occurrence?.occurrenceKey, "20260828-2303");
  assert.equal(occurrence?.intendedAt, "2026-08-28T23:03:00+02:00");
  assert.equal(occurrence?.delayMinutes, 62);
});

test("unsupported refresh targets fail closed", () => {
  assert.throws(
    () => resolveDueOccurrence(new Date("2026-08-27T08:20:00Z"), "12:00"),
    /Unsupported refresh target/,
  );
});


const dstCases = [
  {
    label: "spring-forward",
    offset: "+02:00",
    date: "20260329",
    targets: [
      { target: "10:20", primary: "2026-03-29T08:20:00Z", recovery: "2026-03-29T08:30:00Z", inactive: "2026-03-29T09:20:00Z" },
      { target: "19:03", primary: "2026-03-29T17:03:00Z", recovery: "2026-03-29T17:13:00Z", inactive: "2026-03-29T18:03:00Z" },
      { target: "23:03", primary: "2026-03-29T21:03:00Z", recovery: "2026-03-29T21:13:00Z", inactive: "2026-03-29T22:03:00Z" },
    ],
  },
  {
    label: "fall-back",
    offset: "+01:00",
    date: "20261025",
    targets: [
      { target: "10:20", primary: "2026-10-25T09:20:00Z", recovery: "2026-10-25T09:30:00Z", inactive: "2026-10-25T08:20:00Z" },
      { target: "19:03", primary: "2026-10-25T18:03:00Z", recovery: "2026-10-25T18:13:00Z", inactive: "2026-10-25T17:03:00Z" },
      { target: "23:03", primary: "2026-10-25T22:03:00Z", recovery: "2026-10-25T22:13:00Z", inactive: "2026-10-25T21:03:00Z" },
    ],
  },
];

for (const fixture of dstCases) {
  test(`${fixture.label} day keeps one Rome occurrence and one recovery key for every database target`, () => {
    for (const row of fixture.targets) {
      const primary = resolveDueOccurrence(new Date(row.primary), row.target);
      const recovery = resolveDueOccurrence(new Date(row.recovery), row.target);
      const inactive = resolveDueOccurrence(new Date(row.inactive), row.target);
      const key = `${fixture.date}-${row.target.replace(":", "")}`;

      assert.equal(primary?.occurrenceKey, key, `${fixture.label} ${row.target} primary key`);
      assert.equal(recovery?.occurrenceKey, key, `${fixture.label} ${row.target} recovery key`);
      assert.equal(primary?.delayMinutes, 0, `${fixture.label} ${row.target} primary delay`);
      assert.equal(recovery?.delayMinutes, 10, `${fixture.label} ${row.target} recovery delay`);
      assert.equal(primary?.intendedAt, `${fixture.date.slice(0, 4)}-${fixture.date.slice(4, 6)}-${fixture.date.slice(6, 8)}T${row.target}:00${fixture.offset}`);
      assert.equal(recovery?.intendedAt, primary?.intendedAt);
      assert.equal(inactive, null, `${fixture.label} ${row.target} inactive CET/CEST UTC candidate must fail closed`);
    }
  });
}

test("recovery duplicate lookup suppresses active/successful runs but permits a completed failure retry", () => {
  const key = "20261025-1020";
  const unrelated = { id: 1, display_title: "Full database refresh [20261025-1903] via supabase-cron", status: "completed", conclusion: "success" };
  const failed = { id: 2, display_title: `Full database refresh [${key}] via supabase-cron`, status: "completed", conclusion: "failure" };
  const queued = { id: 3, display_title: `Full database refresh [${key}] via supabase-cron`, status: "queued", conclusion: null };
  const running = { id: 4, display_title: `Full database refresh [${key}] via supabase-cron`, status: "in_progress", conclusion: null };
  const success = { id: 5, display_title: `Full database refresh [${key}] via supabase-cron`, status: "completed", conclusion: "success" };

  assert.equal(existingRunForOccurrence([unrelated, failed], key), null, "a completed failed occurrence must remain recoverable");
  assert.equal(existingRunForOccurrence([failed, queued], key)?.id, queued.id, "a queued duplicate must suppress recovery dispatch");
  assert.equal(existingRunForOccurrence([failed, running], key)?.id, running.id, "an in-progress duplicate must suppress recovery dispatch");
  assert.equal(existingRunForOccurrence([failed, success], key)?.id, success.id, "a successful duplicate must suppress recovery dispatch");
  assert.equal(existingRunForOccurrence([], key), null);
  assert.equal(existingRunForOccurrence([success], ""), null);
});

test("completed occurrence marker and workflow gate use the same DST-stable occurrence key", async () => {
  const [workflow, markerScript] = await Promise.all([
    readFile(new URL("../.github/workflows/full-database-refresh.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/workflows/full-database-refresh-record-completed-refresh-occurrence.sh", import.meta.url), "utf8"),
  ]);

  assert.match(workflow, /ARTIFACT_NAME="full-database-refresh-occurrence-\$OCCURRENCE_KEY"/);
  assert.match(workflow, /select\(\.expired == false\)/);
  assert.match(workflow, /if \[ "\$COMPLETED_COUNT" -gt 0 \]; then\s+SHOULD_RUN=false/);
  assert.match(workflow, /name: full-database-refresh-occurrence-\$\{\{ needs\.resolve-refresh-trigger\.outputs\.occurrence_key \}\}/);
  assert.match(markerScript, /--arg occurrenceKey "\$OCCURRENCE_KEY"/);
  assert.match(markerScript, /occurrenceKey: \$occurrenceKey/);
});
