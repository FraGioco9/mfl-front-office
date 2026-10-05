#!/usr/bin/env node
import fs from "node:fs";

const SCOPES = Object.freeze({
  "production-core": Object.freeze({
    required: Object.freeze([
      "MFL_API_TOKEN",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
      "VERCEL_TOKEN",
    ]),
    optional: Object.freeze([]),
  }),
  "progression-email": Object.freeze({
    required: Object.freeze([
      "SMTP_HOST",
      "SMTP_USERNAME",
      "SMTP_PASSWORD",
      "EMAIL_FROM",
    ]),
    optional: Object.freeze([
      "SMTP_PORT",
      "EMAIL_REPLY_TO",
      "PROGRESSION_EMAIL_TEST_RECIPIENT",
    ]),
  }),
  "all-github": Object.freeze({
    required: Object.freeze([
      "MFL_API_TOKEN",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
      "VERCEL_TOKEN",
      "SMTP_HOST",
      "SMTP_USERNAME",
      "SMTP_PASSWORD",
      "EMAIL_FROM",
    ]),
    optional: Object.freeze([
      "SMTP_PORT",
      "EMAIL_REPLY_TO",
      "PROGRESSION_EMAIL_TEST_RECIPIENT",
    ]),
  }),
});

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

function present(name) {
  return String(process.env[name] || "").trim().length > 0;
}

function statusRows(names, required) {
  return names.map((name) => Object.freeze({ name, required, present: present(name) }));
}

function markdown(report) {
  const lines = [
    "### OPS-08 secret presence audit",
    "",
    "- Scope: " + report.scope,
    "- Values are never printed, hashed, measured, or exported.",
    "",
    "| Variable | Required | Status |",
    "| --- | --- | --- |",
  ];
  for (const row of report.variables) {
    lines.push("| " + row.name + " | " + (row.required ? "yes" : "no") + " | " + (row.present ? "present" : "missing") + " |");
  }
  lines.push(
    "",
    report.ok
      ? "All required variables for this scope are present."
      : "Missing required variables: " + report.missingRequired.join(", ") + ".",
    "",
  );
  return lines.join("\n");
}

const scope = argument("--scope") || "all-github";
const summaryPath = argument("--summary");
const contract = SCOPES[scope];
if (!contract) {
  console.error("Unknown secret audit scope. Allowed: " + Object.keys(SCOPES).join(", "));
  process.exit(2);
}

const variables = [
  ...statusRows(contract.required, true),
  ...statusRows(contract.optional, false),
];
const missingRequired = variables.filter((row) => row.required && !row.present).map((row) => row.name);
const report = Object.freeze({
  scope,
  ok: missingRequired.length === 0,
  variables,
  missingRequired,
});

console.log(JSON.stringify(report));
if (summaryPath) fs.writeFileSync(summaryPath, markdown(report), "utf8");
process.exit(report.ok ? 0 : 1);
