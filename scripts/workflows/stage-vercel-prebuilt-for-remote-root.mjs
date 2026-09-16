import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, normalize, resolve, sep } from "node:path";

const remoteRoot = String(process.env.VERCEL_REMOTE_ROOT || "").trim();

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
