import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const shareApi = await fs.readFile(resolve(siteRoot, "api/evaluation-share.js"), "utf8");
const persistenceDoc = await fs.readFile(resolve(siteRoot, "../SUPABASE_PERSISTENCE.md"), "utf8");

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

includes(shareApi, "const MAX_ACTIVE_EVALUATION_SHARES_PER_WALLET = 10;", "Each wallet must be allowed at most ten active Evaluation shares.");
includes(shareApi, "function evaluationShareExpiresAt(now = new Date())", "Evaluation share creation must use one canonical expiry helper.");
includes(shareApi, "expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);", "Evaluation shares must expire one calendar month after creation.");
includes(shareApi, "expiresAt.setUTCDate(Math.min(dayOfMonth, daysInTargetMonth));", "Evaluation share expiry must clamp month-end dates instead of rolling into a later month.");
includes(shareApi, "rows.length - (MAX_ACTIVE_EVALUATION_SHARES_PER_WALLET - 1)", "Share creation must prune enough old active rows that the new share leaves at most ten active links.");
includes(shareApi, "await pruneOldestActiveShares(wallet);", "New Evaluation shares must enforce the ten-link active-share cap before insertion.");
includes(shareApi, "const expiresAt = evaluationShareExpiresAt();", "New Evaluation shares must use the one-month expiry owner.");
excludes(shareApi, "rows.length < 5", "Evaluation shares must not regress to the old five-active-share limit.");
excludes(shareApi, "Date.now() + 24 * 60 * 60 * 1000", "Evaluation shares must not regress to the old 24-hour lifetime.");
includes(persistenceDoc, "one calendar month after share creation", "Supabase persistence documentation must state the Evaluation share lifetime.");

console.log("Evaluation shares allow ten active links per wallet and expire one calendar month after creation, with month-end clamping and no 24-hour fallback.");