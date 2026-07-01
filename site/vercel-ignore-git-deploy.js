const isAllowedManualDeploy = process.env.ALLOW_VERCEL_ACTION_DEPLOY === "1";
const isVercelGitDeploy = Boolean(process.env.VERCEL_GIT_PROVIDER || process.env.VERCEL_GIT_COMMIT_REF);

if (isAllowedManualDeploy) {
  console.log("Manual Vercel deploy allowed.");
  process.exit(1);
}

if (isVercelGitDeploy) {
  console.log("Skipping automatic Vercel Git deployment. Use the GitHub Actions deploy workflows instead.");
  process.exit(0);
}

console.log("No Vercel Git deployment detected. Continuing deploy.");
process.exit(1);