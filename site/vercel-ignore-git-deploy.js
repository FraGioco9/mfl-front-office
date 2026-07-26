const isAllowedManualDeploy = process.env.ALLOW_VERCEL_ACTION_DEPLOY === "1";

if (isAllowedManualDeploy) {
  console.log("Manual Vercel deploy allowed.");
  process.exit(1);
}

console.log("Deploying the latest GitHub commit to Vercel.");
process.exit(1);
