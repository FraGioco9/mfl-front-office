const token = String(process.env.VERCEL_TOKEN || "").trim();
const projectId = String(process.env.VERCEL_PROJECT_ID || "").trim();
const teamId = String(process.env.VERCEL_ORG_ID || "").trim();

if (!token || !projectId || !teamId) {
  throw new Error("VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_ORG_ID are required.");
}

const endpoint = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`);
endpoint.searchParams.set("teamId", teamId);

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

const update = await fetch(endpoint, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ rootDirectory: null }),
});

if (!update.ok) {
  throw new Error(`Failed to clear Vercel rootDirectory: ${update.status} ${await update.text()}`);
}

const verify = await fetch(endpoint, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!verify.ok) {
  throw new Error(`Failed to verify Vercel rootDirectory: ${verify.status} ${await verify.text()}`);
}

const project = await verify.json();
if (project.rootDirectory != null && String(project.rootDirectory).trim()) {
  throw new Error(`Vercel rootDirectory is still set to ${JSON.stringify(project.rootDirectory)}.`);
}

console.log("Verified Vercel project rootDirectory is repository root.");
