import { readFile, writeFile } from "node:fs/promises";

const projectFile = process.argv[2] || ".vercel/project.json";
const project = JSON.parse(await readFile(projectFile, "utf8"));

if (!project.settings || typeof project.settings !== "object" || Array.isArray(project.settings)) {
  project.settings = {};
}

project.settings.rootDirectory = null;
if (Object.hasOwn(project, "rootDirectory")) {
  project.rootDirectory = null;
}

await writeFile(projectFile, `${JSON.stringify(project)}\n`, "utf8");
console.log(`Normalized Vercel project root to repository root in ${projectFile}.`);
