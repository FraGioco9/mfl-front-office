import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DEPLOYMENT_COMMIT_FILE = ".mfl-deploy-commit";
export const DEPLOYMENT_COMMIT_MODULE = "api/_deployment-commit.generated.js";

export function normalizeDeploymentCommit(value, { allowEmpty = true } = {}) {
  const commit = String(value ?? "").trim().toLowerCase();
  if (!commit) {
    if (allowEmpty) return "";
    throw new Error("Deployment commit is required.");
  }
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error("Deployment commit must be a 40-character hexadecimal SHA.");
  }
  return commit;
}

export function deploymentCommitPath(root = process.cwd()) {
  return resolve(root, DEPLOYMENT_COMMIT_FILE);
}

export function deploymentCommitModulePath(root = process.cwd()) {
  return resolve(root, DEPLOYMENT_COMMIT_MODULE);
}

export function resolveDeploymentCommit({ root = process.cwd(), env = process.env } = {}) {
  const filePath = deploymentCommitPath(root);
  const fileCommit = existsSync(filePath)
    ? normalizeDeploymentCommit(readFileSync(filePath, "utf8"))
    : "";
  const envCommit = normalizeDeploymentCommit(env.MFL_DEPLOY_COMMIT || "");

  if (fileCommit && envCommit && fileCommit !== envCommit) {
    throw new Error("Deployment commit file and environment disagree.");
  }

  return fileCommit || envCommit;
}

export function resolveRepositoryCommit(root = process.cwd()) {
  try {
    return normalizeDeploymentCommit(execFileSync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ));
  } catch {
    return "";
  }
}

export function writeDeploymentCommitModule(value, { root = process.cwd() } = {}) {
  const commit = normalizeDeploymentCommit(value);
  const modulePath = deploymentCommitModulePath(root);
  mkdirSync(dirname(modulePath), { recursive: true });
  writeFileSync(
    modulePath,
    `module.exports = ${JSON.stringify(commit)};\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return commit;
}

export function materializeDeploymentCommit({
  root = process.cwd(),
  env = process.env,
  repositoryCommit,
} = {}) {
  const explicitCommit = resolveDeploymentCommit({ root, env });
  if (explicitCommit) {
    writeDeploymentCommitModule(explicitCommit, { root });
    return explicitCommit;
  }

  const localCommit = repositoryCommit === undefined
    ? resolveRepositoryCommit(root)
    : normalizeDeploymentCommit(repositoryCommit);
  writeDeploymentCommitModule(localCommit, { root });
  return localCommit;
}

export function writeDeploymentCommit(value, { root = process.cwd() } = {}) {
  const commit = normalizeDeploymentCommit(value, { allowEmpty: false });
  writeFileSync(deploymentCommitPath(root), `${commit}\n`, { encoding: "utf8", mode: 0o600 });
  writeDeploymentCommitModule(commit, { root });
  return commit;
}
