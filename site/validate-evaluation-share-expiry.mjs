import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const shareApi = await fs.readFile(resolve(siteRoot, "api/evaluation-share.js"), "utf8");
const saveApi = await fs.readFile(resolve(siteRoot, "api/evaluation-save.js"), "utf8");
const persistenceDoc = await fs.readFile(resolve(siteRoot, "../SUPABASE_PERSISTENCE.md"), "utf8");
const expiryMigration = await fs.readFile(
  resolve(siteRoot, "../supabase/migrations/20260904165225_extend_evaluation_share_expiry_to_one_year.sql"),
  "utf8",
);

function includes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message);
  }
}

function excludes(source, unexpected, message) {
  if (source.includes(unexpected)) {
    throw new Error(message);
  }
}

includes(shareApi, "function evaluationShareExpiresAt(now = new Date())", "Evaluation share creation must use one canonical expiry helper.");
includes(shareApi, "expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);", "Evaluation shares must expire one calendar year after creation.");
includes(shareApi, "expiresAt.setUTCDate(Math.min(dayOfMonth, daysInTargetMonth));", "Evaluation share expiry must clamp leap-day/month-end dates instead of rolling into a later month.");
includes(shareApi, "const expiresAt = evaluationShareExpiresAt();", "New Evaluation shares must use the one-year expiry owner.");
excludes(shareApi, "MAX_ACTIVE_EVALUATION_SHARES_PER_WALLET", "Evaluation shares must not retain a per-wallet active-share cap.");
excludes(shareApi, "pruneOldestActiveShares", "Creating a share must not delete older active shares.");
excludes(shareApi, "activeShareRows", "Share creation must not scan existing shares to enforce a count limit.");
excludes(shareApi, "Date.now() + 24 * 60 * 60 * 1000", "Evaluation shares must not regress to the old 24-hour lifetime.");

includes(saveApi, "const MAX_SAVED_EVALUATIONS_PER_WALLET = 100;", "Each wallet must be allowed up to one hundred saved Evaluations.");
includes(saveApi, "savedEvaluationCount(wallet) >= MAX_SAVED_EVALUATIONS_PER_WALLET", "New saved Evaluations must enforce the one-hundred-save cap.");
includes(saveApi, "maximum of ${MAX_SAVED_EVALUATIONS_PER_WALLET} evaluations", "The save-limit error must report the canonical one-hundred-save cap.");
includes(saveApi, "limit=${MAX_SAVED_EVALUATIONS_PER_WALLET}", "Saved Evaluation list reads must return up to the full one-hundred-save cap.");

includes(expiryMigration, "expires_at = created_at + interval '1 year'", "The Supabase migration must extend existing Evaluation shares to the new one-year lifetime.");
includes(persistenceDoc, "up to 100 saved Evaluations per wallet", "Supabase persistence documentation must state the saved-Evaluation limit.");
includes(persistenceDoc, "no per-wallet share-count limit", "Supabase persistence documentation must state that shared Evaluations are unlimited per wallet.");
includes(persistenceDoc, "one calendar year after share creation", "Supabase persistence documentation must state the Evaluation share lifetime.");

console.log("Evaluation persistence allows up to 100 saved Evaluations per wallet, unlimited shared Evaluations, and one-year share expiry with calendar clamping.");