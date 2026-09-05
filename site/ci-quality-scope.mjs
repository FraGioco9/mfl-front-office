import { appendFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", allowFailure ? "ignore" : "inherit"] }).replace(/\r\n?/g, "\n");
  } catch (error) {
    if (allowFailure) return "";
    throw error;
  }
}

export function workflowDiffHasSubstantiveChanges(diff) {
  for (const line of String(diff || "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!line || line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) continue;
    if (!line.startsWith("+") && !line.startsWith("-")) continue;
    const changedLine = line.slice(1);
    if (!changedLine || /^name:\s/.test(changedLine)) continue;
    return true;
  }
  return false;
}

export function classifyChangedFiles(files, workflowDiffForFile = () => "") {
  let site = false;
  let builder = false;
  let workflow = false;

  for (const file of files) {
    if (file.startsWith("site/") || file === ".gitattributes") site = true;
    if (/^(?:.*\/)?[^/]+\.py$/.test(file) || /(?:^|\/)requirements[^/]*\.txt$/.test(file) || /(?:^|\/)pyproject\.toml$/.test(file)) builder = true;
    if (file === ".vercelignore") workflow = true;
    if (/^\.github\/workflows\/.*\.ya?ml$/.test(file) && workflowDiffHasSubstantiveChanges(workflowDiffForFile(file))) workflow = true;
  }

  return Object.freeze({ site, builder, workflow, quality: site || builder || workflow });
}

function gitSucceeds(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function commitExists(sha) {
  return Boolean(sha) && !/^0+$/.test(sha) && gitSucceeds(["cat-file", "-e", `${sha}^{commit}`]);
}

async function main() {
  const eventName = process.env.EVENT_NAME || "";
  const currentSha = process.env.CURRENT_SHA || "";
  let baseSha = eventName === "pull_request" ? process.env.PR_BASE_SHA || "" : process.env.BEFORE_SHA || "";
  const headSha = eventName === "pull_request" ? process.env.PR_HEAD_SHA || currentSha : currentSha;

  if (!commitExists(baseSha)) {
    baseSha = git(["rev-parse", `${headSha}^`], { allowFailure: true }).trim();
  }

  let scope;
  let changedFiles = [];
  if (!commitExists(baseSha)) {
    scope = Object.freeze({ site: true, builder: true, workflow: true, quality: true });
  } else {
    changedFiles = git(["diff", "--name-only", baseSha, headSha]).split("\n").filter(Boolean);
    scope = classifyChangedFiles(changedFiles, (file) => git(["diff", "--unified=0", baseSha, headSha, "--", file]));
  }

  process.stdout.write("Changed files:\n");
  for (const file of changedFiles) process.stdout.write(`  ${file}\n`);
  process.stdout.write(`Site changes: ${scope.site}\n`);
  process.stdout.write(`Database builder changes: ${scope.builder}\n`);
  process.stdout.write(`Substantive workflow/deployment changes: ${scope.workflow}\n`);
  process.stdout.write(`Run repository validation: ${scope.quality}\n`);

  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error("GITHUB_OUTPUT is required when ci-quality-scope.mjs runs as a workflow command.");
  await appendFile(outputPath, `${Object.entries(scope).map(([key, value]) => `${key}=${value}`).join("\n")}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
