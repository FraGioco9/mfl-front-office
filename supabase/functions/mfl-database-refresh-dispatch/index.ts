import { resolveDueOccurrence } from "./schedule.mjs";

const DEFAULT_REPOSITORY = "FraGioco9/mfl-front-office";
const DEFAULT_WORKFLOW = "full-database-refresh.yml";
const DEFAULT_REF = "main";
const MAX_DISPATCH_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [2_000, 5_000];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function secretsMatch(received: string, expected: string) {
  const [left, right] = await Promise.all([digest(received), digest(expected)]);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "mfl-front-office-supabase-scheduler",
  };
}

async function githubFetchWithRetry(url: string, init: RequestInit) {
  let lastStatus = 0;
  let lastResponse = "";
  let lastError = "";
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_DISPATCH_ATTEMPTS; attempt += 1) {
    attempts = attempt;
    try {
      const response = await fetch(url, init);
      lastStatus = response.status;
      if (response.ok) {
        return {
          response,
          attempts,
          status: response.status,
          responseBody: "",
          message: "",
        };
      }

      lastResponse = (await response.text()).slice(0, 1000);
      const transient = response.status === 429 || response.status >= 500;
      if (!transient) {
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < MAX_DISPATCH_ATTEMPTS) {
      await sleep(RETRY_DELAYS_MS[attempt - 1] || RETRY_DELAYS_MS.at(-1) || 2_000);
    }
  }

  return {
    response: null,
    attempts,
    status: lastStatus || null,
    responseBody: lastResponse || null,
    message: lastError || null,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const expectedSecret = Deno.env.get("SCHEDULER_SHARED_SECRET") || "";
  const receivedSecret = request.headers.get("x-scheduler-secret") || "";
  if (!expectedSecret || !receivedSecret || !(await secretsMatch(receivedSecret, expectedSecret))) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  let body: { target?: string; recovery?: boolean };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const target = String(body.target || "");
  const recovery = body.recovery === true;
  let occurrence;
  try {
    occurrence = resolveDueOccurrence(new Date(), target);
  } catch (error) {
    return json(400, {
      ok: false,
      error: "invalid_target",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // Supabase SQL filters both the inactive CET/CEST candidate and the allowed
  // primary/recovery minutes before making this HTTP call. Keep this second
  // fail-closed check against stale or manually replayed requests.
  if (!occurrence) {
    return json(200, { ok: true, dispatched: false, reason: "not_due", target, recovery });
  }

  const token = Deno.env.get("GITHUB_ACTIONS_DISPATCH_TOKEN") || "";
  if (!token) {
    return json(500, { ok: false, error: "github_token_missing" });
  }

  const repository = Deno.env.get("GITHUB_REPOSITORY") || DEFAULT_REPOSITORY;
  const workflow = Deno.env.get("GITHUB_WORKFLOW") || DEFAULT_WORKFLOW;
  const ref = Deno.env.get("GITHUB_REF") || DEFAULT_REF;
  const headers = githubHeaders(token);

  if (recovery) {
    const runsUrl = new URL(
      `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/runs`,
    );
    runsUrl.searchParams.set("event", "workflow_dispatch");
    runsUrl.searchParams.set("branch", ref);
    runsUrl.searchParams.set("per_page", "50");

    const lookup = await githubFetchWithRetry(runsUrl.toString(), {
      method: "GET",
      headers,
    });
    if (!lookup.response) {
      return json(502, {
        ok: false,
        error: "github_recovery_check_failed",
        status: lookup.status,
        response: lookup.responseBody,
        message: lookup.message,
        occurrence: occurrence.occurrenceKey,
        attempts: lookup.attempts,
      });
    }

    let runs: Array<{
      id?: number;
      display_title?: string;
      status?: string;
      conclusion?: string | null;
    }> = [];
    try {
      const payload = await lookup.response.json();
      runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
    } catch (error) {
      return json(502, {
        ok: false,
        error: "github_recovery_check_invalid_response",
        message: error instanceof Error ? error.message : String(error),
        occurrence: occurrence.occurrenceKey,
      });
    }

    const existingRun = runs.find((run) => {
      const sameOccurrence = String(run.display_title || "").includes(
        `[${occurrence.occurrenceKey}]`,
      );
      if (!sameOccurrence) return false;
      return run.status !== "completed" || run.conclusion === "success";
    });

    if (existingRun) {
      return json(200, {
        ok: true,
        dispatched: false,
        reason: "occurrence_already_present",
        target,
        recovery: true,
        occurrence: occurrence.occurrenceKey,
        runId: existingRun.id || null,
        runStatus: existingRun.status || null,
        runConclusion: existingRun.conclusion || null,
      });
    }
  }

  const triggeredAt = new Date().toISOString();
  const dispatchUrl = `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`;
  const dispatchBody = JSON.stringify({
    ref,
    inputs: {
      trigger_source: "supabase-cron",
      intended_at: occurrence.intendedAt,
      occurrence_key: occurrence.occurrenceKey,
      triggered_at: triggeredAt,
    },
  });

  const dispatch = await githubFetchWithRetry(dispatchUrl, {
    method: "POST",
    headers,
    body: dispatchBody,
  });

  if (!dispatch.response) {
    return json(502, {
      ok: false,
      error: "github_dispatch_failed",
      status: dispatch.status,
      response: dispatch.responseBody,
      message: dispatch.message,
      occurrence: occurrence.occurrenceKey,
      recovery,
      attempts: dispatch.attempts,
    });
  }

  return json(200, {
    ok: true,
    dispatched: true,
    target,
    recovery,
    occurrence: occurrence.occurrenceKey,
    intendedAt: occurrence.intendedAt,
    triggeredAt,
    delayMinutes: occurrence.delayMinutes,
    attempts: dispatch.attempts,
  });
});
