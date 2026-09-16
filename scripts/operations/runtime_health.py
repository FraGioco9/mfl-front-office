from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from scripts.marketplace.mfl_marketplace_runtime_state import (
    REQUEST_TIMEOUT_SECONDS,
    RUNTIME_BUCKET,
    ensure_bucket,
    request_headers,
)

HEALTH_OBJECTS = {
    "database": "health/database-refresh.json",
    "marketplace": "health/marketplace-refresh.json",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _nonnegative_int(value: object) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, parsed)


def next_health_marker(
    previous: object,
    *,
    surface: str,
    outcome: str,
    attempted_at: str,
    trigger_source: str,
    occurrence_key: str,
    run_id: str,
    run_attempt: str,
) -> dict[str, object]:
    if surface not in HEALTH_OBJECTS:
        raise ValueError(f"Unsupported health surface: {surface}")
    normalized_outcome = str(outcome or "").strip().lower()
    if normalized_outcome not in {"success", "failure", "cancelled"}:
        raise ValueError(f"Unsupported refresh outcome: {outcome}")

    prior = previous if isinstance(previous, dict) else {}
    prior_failures = _nonnegative_int(prior.get("consecutiveFailures"))
    prior_success = str(prior.get("lastSuccessAt") or "").strip()

    if normalized_outcome == "success":
        consecutive_failures = 0
        last_success_at = attempted_at
    else:
        consecutive_failures = prior_failures + 1
        last_success_at = prior_success

    return {
        "schemaVersion": 1,
        "surface": surface,
        "lastOutcome": normalized_outcome,
        "lastAttemptAt": attempted_at,
        "lastSuccessAt": last_success_at,
        "consecutiveFailures": consecutive_failures,
        "triggerSource": str(trigger_source or "").strip(),
        "occurrenceKey": str(occurrence_key or "").strip(),
        "runId": str(run_id or "").strip(),
        "runAttempt": str(run_attempt or "").strip(),
    }


def _object_url(supabase_url: str, object_path: str) -> str:
    encoded = "/".join(quote(part, safe="") for part in object_path.split("/"))
    return f"{supabase_url.rstrip('/')}/storage/v1/object/{RUNTIME_BUCKET}/{encoded}"


def read_previous_marker(
    *,
    supabase_url: str,
    service_role_key: str,
    object_path: str,
) -> dict[str, object]:
    request = Request(
        _object_url(supabase_url, object_path),
        headers=request_headers(service_role_key),
        method="GET",
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code == 404:
            return {}
        raise
    return payload if isinstance(payload, dict) else {}


def publish_marker(
    marker: dict[str, object],
    *,
    supabase_url: str,
    service_role_key: str,
    object_path: str,
) -> None:
    ensure_bucket(supabase_url, service_role_key)
    body = json.dumps(marker, separators=(",", ":"), sort_keys=True).encode("utf-8")
    request = Request(
        _object_url(supabase_url, object_path),
        data=body,
        headers={
            **request_headers(service_role_key),
            "x-upsert": "true",
            "cache-control": "no-cache",
        },
        method="POST",
    )
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS):
        return


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Record the outcome of one scheduled production refresh."
    )
    parser.add_argument("--surface", required=True, choices=sorted(HEALTH_OBJECTS))
    parser.add_argument(
        "--outcome",
        required=True,
        choices=("success", "failure", "cancelled"),
    )
    parser.add_argument("--trigger-source", default="")
    parser.add_argument("--occurrence-key", default="")
    parser.add_argument("--run-id", default="")
    parser.add_argument("--run-attempt", default="")
    args = parser.parse_args()

    supabase_url = str(os.environ.get("SUPABASE_URL") or "").strip()
    service_role_key = str(os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not supabase_url or not service_role_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    object_path = HEALTH_OBJECTS[args.surface]
    previous = read_previous_marker(
        supabase_url=supabase_url,
        service_role_key=service_role_key,
        object_path=object_path,
    )
    marker = next_health_marker(
        previous,
        surface=args.surface,
        outcome=args.outcome,
        attempted_at=_utc_now(),
        trigger_source=args.trigger_source,
        occurrence_key=args.occurrence_key,
        run_id=args.run_id,
        run_attempt=args.run_attempt,
    )
    publish_marker(
        marker,
        supabase_url=supabase_url,
        service_role_key=service_role_key,
        object_path=object_path,
    )
    print(
        f"Recorded {args.surface} refresh health: "
        f"{marker['lastOutcome']} ({marker['consecutiveFailures']} consecutive failures)."
    )


if __name__ == "__main__":
    main()
