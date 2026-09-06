import { invariant } from "./validation/assertions.mjs";
import { classifyChangedFiles, workflowDiffHasSubstantiveChanges } from "./ci-quality-scope.mjs";


invariant(!workflowDiffHasSubstantiveChanges('@@ -1 +1 @@\n-name: Old\n+name: New\n'), "Workflow display-name-only edits must not trigger substantive workflow validation.");
invariant(workflowDiffHasSubstantiveChanges('@@ -1 +1 @@\n-run: echo old\n+run: echo new\n'), "Workflow behavior edits must trigger workflow validation.");

const siteScope = classifyChangedFiles(["site/styles.css"]);
invariant(siteScope.site && siteScope.quality && !siteScope.builder, "Site files must trigger site quality checks.");
const builderScope = classifyChangedFiles(["scripts/database/rebuild_database.py"]);
invariant(builderScope.builder && builderScope.quality && !builderScope.site, "Python builder files must trigger builder checks.");
const workflowScope = classifyChangedFiles([".github/workflows/site-quality.yml"], () => '@@ -1 +1 @@\n-run: old\n+run: new\n');
invariant(workflowScope.workflow && workflowScope.quality, "Substantive workflow edits must trigger workflow checks.");
const nameOnlyScope = classifyChangedFiles([".github/workflows/site-quality.yml"], () => '@@ -1 +1 @@\n-name: Old\n+name: New\n');
invariant(!nameOnlyScope.workflow && !nameOnlyScope.quality, "Workflow display-name-only edits must remain cheap.");
const deploymentScope = classifyChangedFiles([".vercelignore"]);
invariant(deploymentScope.workflow && deploymentScope.quality, "Deployment packaging changes must trigger workflow checks.");

console.log("Site Quality change-scope classifier regression validation passed.");
