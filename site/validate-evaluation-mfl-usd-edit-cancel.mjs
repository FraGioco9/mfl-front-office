import { readFile } from "node:fs/promises";

// Keep MFL/USD edits draft-only until the user explicitly confirms them.
const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [source, generated] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-evaluation-runtime.js"),
]);

for (const [label, code] of [["canonical app core", source], ["generated Evaluation runtime", generated]]) {
  invariant(
    code.includes("function cancelEvaluationMflPerUsd()"),
    `${label} must expose an explicit MFL/USD edit cancel path.`,
  );
  invariant(
    code.includes('evaluationMflUsdInput.addEventListener("blur", cancelEvaluationMflPerUsd);'),
    `${label} must discard the MFL/USD draft when focus leaves the editor.`,
  );
  invariant(
    !code.includes('evaluationMflUsdInput.addEventListener("blur", commitEvaluationMflPerUsd);'),
    `${label} must not commit MFL/USD changes on blur.`,
  );
  invariant(
    code.includes('if (event.key === "Enter") {\n    event.preventDefault();\n    commitEvaluationMflPerUsd();'),
    `${label} must keep Enter as an explicit MFL/USD commit action.`,
  );
  invariant(
    code.includes('if (event.key === "Escape") {\n    event.preventDefault();\n    cancelEvaluationMflPerUsd();'),
    `${label} must discard MFL/USD changes on Escape.`,
  );
  invariant(
    code.includes("if (evaluationMflUsdEditor.hidden) {\n    renderEvaluationMflPerUsdControl(true);\n  } else {\n    commitEvaluationMflPerUsd();"),
    `${label} must keep the checkmark button as an explicit MFL/USD commit action.`,
  );
}

console.log("MFL/USD edit cancellation validation passed.");
