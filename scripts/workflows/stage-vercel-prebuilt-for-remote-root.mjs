import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, normalize, resolve, sep } from "node:path";

const token = String(process.env.VERCEL_TOKEN || "").trim();
const projectId = String(process.env.VERCEL_PROJECT_ID || "").trim();
const teamId = String(process.env.VERCEL_ORG_ID || "").trim();

if (!token || !projectId || !teamId) {
  throw new Error("VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_ORG_ID are required.");
}

const endpoint = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`);
endpoint.searchParams.set("teamId", teamId);

const response = await fetch(endpoint, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!response.ok) {
  throw new Error(`Failed to read Vercel project settings: ${response.status} ${await response.text()}`);
}

const project = await response.json();
const remoteRoot = String(project.rootDirectory || "").trim();

if (!remoteRoot) {
  console.log("Vercel project already deploys from repository root; no prebuilt staging needed.");
  process.exit(0);
}

const normalizedRoot = normalize(remoteRoot);
if (
  isAbsolute(normalizedRoot)
  || normalizedRoot === ".."
  || normalizedRoot.startsWith(`..${sep}`)
) {
  throw new Error(`Unsafe Vercel rootDirectory: ${JSON.stringify(remoteRoot)}`);
}

const source = resolve(".vercel/output");
const destination = resolve(normalizedRoot, ".vercel/output");
const repositoryRoot = resolve(".");

await stat(source);

if (!destination.startsWith(`${repositoryRoot}${sep}`)) {
  throw new Error(`Resolved Vercel prebuilt destination escaped repository root: ${destination}`);
}

await rm(destination, { recursive: true, force: true });
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });

console.log(`Staged prebuilt Vercel output for remote rootDirectory ${JSON.stringify(remoteRoot)}.`);
