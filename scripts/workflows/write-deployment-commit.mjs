import {
  deploymentCommitModulePath,
  deploymentCommitPath,
  writeDeploymentCommit,
} from "../../deployment-commit.mjs";

const commit = writeDeploymentCommit(process.argv[2]);
console.log(
  `Bound deployment commit ${commit} at ${deploymentCommitPath()} and ${deploymentCommitModulePath()}.`,
);
