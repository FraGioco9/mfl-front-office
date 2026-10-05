#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Policy:
    key: str
    role: str
    target_days: int | None
    automatic_delete: bool
    rationale: str


POLICIES: tuple[tuple[str, str, Policy], ...] = (
    ("exact", "mfl_database", Policy(
        "canonical_database", "canonical", None, False,
        "Latest valid database is consumed across workflows; never trim from this report.",
    )),
    ("prefix", "full-database-refresh-occurrence-", Policy(
        "refresh_occurrence", "scheduler-state", 90, False,
        "Deduplicates scheduled refresh occurrences across recovery dispatches.",
    )),
    ("prefix", "production-deployment-identity-", Policy(
        "deployment_identity", "rollback-evidence", 90, False,
        "Rollback/runbook evidence ties production source, version and database generation.",
    )),
    ("prefix", "performance-baseline-", Policy(
        "performance_baseline", "benchmark-evidence", 90, False,
        "Historical performance evidence is intentionally retained for cross-run comparison.",
    )),
    ("exact", "mfl_marketplace_state", Policy(
        "marketplace_state", "ephemeral-state", 1, False,
        "Marketplace state is published elsewhere and the workflow already keeps one day.",
    )),
    ("exact", "progression-email-preview", Policy(
        "email_preview", "preview", 7, False,
        "Manual preview artifact; existing seven-day retention is sufficient.",
    )),
    ("prefix", "full-database-refresh-baseline-", Policy(
        "refresh_baseline", "same-run-recovery", 14, False,
        "Restore helper addresses only the same GITHUB_RUN_ID; candidate for shorter retention after observed rerun-age review.",
    )),
    ("prefix", "full-database-refresh-resume-", Policy(
        "refresh_resume", "same-run-recovery", 14, False,
        "Resume helper requires the same GITHUB_RUN_ID; candidate for shorter retention after observed rerun-age review.",
    )),
    ("prefix", "mfl_database-recovery-", Policy(
        "competition_recovery", "manual-recovery", 30, False,
        "Failure-only recovery database; retain long enough for operator recovery, but not indefinitely.",
    )),
    ("prefix", "full-database-refresh-checkpoints-", Policy(
        "checkpoint_telemetry", "diagnostic", 30, False,
        "Small checkpoint metadata is diagnostic once production identity is recorded.",
    )),
    ("prefix", "full-database-refresh-trigger-", Policy(
        "trigger_telemetry", "diagnostic", 30, False,
        "Scheduler timing telemetry is diagnostic and reviewed in monthly windows.",
    )),
    ("prefix", "actions-artifact-capacity-", Policy(
        "capacity_report", "diagnostic", 30, False,
        "The monthly report only needs one review cycle plus overlap.",
    )),
)


def parse_timestamp(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def classify(name: str) -> Policy:
    for mode, token, policy in POLICIES:
        if mode == "exact" and name == token:
            return policy
        if mode == "prefix" and name.startswith(token):
            return policy
    return Policy(
        "unknown", "review", None, False,
        "Unclassified artifact; review ownership before changing retention.",
    )


def inferred_retention_days(artifact: dict[str, Any]) -> int | None:
    created = parse_timestamp(artifact.get("created_at"))
    expires = parse_timestamp(artifact.get("expires_at"))
    if not created or not expires or expires <= created:
        return None
    return max(1, math.ceil((expires - created).total_seconds() / 86400))


def artifact_row(artifact: dict[str, Any]) -> dict[str, Any]:
    name = str(artifact.get("name") or "").strip()
    size = max(0, int(artifact.get("size_in_bytes") or 0))
    policy = classify(name)
    observed_days = inferred_retention_days(artifact)
    excess_days = 0
    if policy.target_days is not None and observed_days is not None:
        excess_days = max(0, observed_days - policy.target_days)
    return {
        "id": artifact.get("id"),
        "name": name,
        "sizeInBytes": size,
        "createdAt": artifact.get("created_at"),
        "expiresAt": artifact.get("expires_at"),
        "workflowRunId": (artifact.get("workflow_run") or {}).get("id"),
        "policy": policy.key,
        "role": policy.role,
        "targetRetentionDays": policy.target_days,
        "observedRetentionDays": observed_days,
        "candidateExcessDays": excess_days,
        "candidateByteDays": size * excess_days,
        "automaticDelete": policy.automatic_delete,
        "rationale": policy.rationale,
    }


def mib(value: int) -> float:
    return round(value / (1024 * 1024), 2)


def gib(value: int) -> float:
    return round(value / (1024 * 1024 * 1024), 3)


def build_report(payload: list[dict[str, Any]], generated_at: datetime) -> dict[str, Any]:
    rows = [
        artifact_row(item)
        for item in payload
        if isinstance(item, dict) and not bool(item.get("expired"))
    ]
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[row["policy"]].append(row)

    summary = []
    for key in sorted(groups):
        group = groups[key]
        bytes_total = sum(int(row["sizeInBytes"]) for row in group)
        candidate_byte_days = sum(int(row["candidateByteDays"]) for row in group)
        created = [parse_timestamp(row["createdAt"]) for row in group]
        created = [stamp for stamp in created if stamp is not None]
        first = min(created).isoformat().replace("+00:00", "Z") if created else None
        last = max(created).isoformat().replace("+00:00", "Z") if created else None
        example = group[0]
        summary.append({
            "policy": key,
            "role": example["role"],
            "count": len(group),
            "sizeInBytes": bytes_total,
            "sizeMiB": mib(bytes_total),
            "oldestCreatedAt": first,
            "newestCreatedAt": last,
            "targetRetentionDays": example["targetRetentionDays"],
            "candidateCount": sum(1 for row in group if row["candidateExcessDays"] > 0),
            "candidateByteDays": candidate_byte_days,
            "candidateGiBdays": round(candidate_byte_days / (1024 ** 3), 3),
            "rationale": example["rationale"],
        })

    total_bytes = sum(int(row["sizeInBytes"]) for row in rows)
    candidate_byte_days = sum(int(row["candidateByteDays"]) for row in rows)
    largest = sorted(rows, key=lambda row: int(row["sizeInBytes"]), reverse=True)[:10]
    candidates = sorted(
        [row for row in rows if row["candidateExcessDays"] > 0],
        key=lambda row: int(row["candidateByteDays"]),
        reverse=True,
    )

    return {
        "generatedAt": generated_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "nonExpiredArtifactCount": len(rows),
        "totalSizeInBytes": total_bytes,
        "totalSizeMiB": mib(total_bytes),
        "totalSizeGiB": gib(total_bytes),
        "candidateByteDays": candidate_byte_days,
        "candidateGiBdays": round(candidate_byte_days / (1024 ** 3), 3),
        "deletionMode": "report-only",
        "policySummary": summary,
        "largestArtifacts": largest,
        "retentionCandidates": candidates,
    }


def markdown(report: dict[str, Any]) -> str:
    lines = [
        "### OPS-07 Actions artifact capacity report",
        "",
        f"- Generated: `{report['generatedAt']}`",
        f"- Non-expired artifacts: **{report['nonExpiredArtifactCount']}**",
        f"- Current artifact storage: **{report['totalSizeMiB']} MiB ({report['totalSizeGiB']} GiB)**",
        f"- Candidate retention exposure: **{report['candidateGiBdays']} GiB-days**",
        "- Mode: **report-only** — no artifact is deleted and no retention is changed.",
        "",
        "| Policy | Role | Count | MiB | Target days | Candidates | Candidate GiB-days |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in report["policySummary"]:
        target = row["targetRetentionDays"]
        lines.append(
            f"| `{row['policy']}` | {row['role']} | {row['count']} | {row['sizeMiB']} | "
            f"{target if target is not None else 'preserve'} | {row['candidateCount']} | {row['candidateGiBdays']} |"
        )

    lines.extend(["", "#### Largest non-expired artifacts", "", "| Artifact | MiB | Role | Observed days |", "| --- | ---: | --- | ---: |"])
    for row in report["largestArtifacts"]:
        lines.append(
            f"| `{row['name']}` | {mib(int(row['sizeInBytes']))} | {row['role']} | "
            f"{row['observedRetentionDays'] if row['observedRetentionDays'] is not None else 'n/a'} |"
        )

    if report["retentionCandidates"]:
        lines.extend([
            "",
            "#### Review candidates",
            "",
            "These are recommendations only. Change workflow retention only after confirming restore/retry behavior and rerun age.",
            "",
            "| Artifact | Role | Observed | Target | MiB |",
            "| --- | --- | ---: | ---: | ---: |",
        ])
        for row in report["retentionCandidates"][:20]:
            lines.append(
                f"| `{row['name']}` | {row['role']} | {row['observedRetentionDays']} | "
                f"{row['targetRetentionDays']} | {mib(int(row['sizeInBytes']))} |"
            )
    else:
        lines.extend(["", "No retention candidate exceeded its policy target in this snapshot."])

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--summary")
    parser.add_argument("--generated-at")
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise SystemExit("Artifact inventory input must be a JSON array.")

    generated_at = parse_timestamp(args.generated_at) if args.generated_at else datetime.now(timezone.utc)
    if generated_at is None:
        raise SystemExit("--generated-at must be ISO 8601.")

    report = build_report(payload, generated_at)
    Path(args.output).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if args.summary:
        Path(args.summary).write_text(markdown(report), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
