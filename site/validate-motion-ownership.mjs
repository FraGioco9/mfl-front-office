import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [motion, controls, interactions, staticUi, selectionStack] = await Promise.all([
  read("./motion.css"),
  read("./controls.css"),
  read("./control-interactions-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./selection-stack-runtime.js"),
]);

for (const token of [
  "--mfl-motion-fast: 120ms;",
  "--mfl-motion-tooltip: 170ms;",
  "--mfl-motion-standard: 180ms;",
  "--mfl-motion-expand: 200ms;",
  "--mfl-motion-slow: 220ms;",
]) {
  invariant(motion.includes(token), `Global motion contract is missing ${token}`);
}

invariant(
  controls.startsWith('@import url("/motion.css");'),
  "Shared controls must load the canonical motion timing contract before consuming it.",
);
invariant(controls.includes("var(--mfl-motion-fast)"), "Shared controls must consume the fast motion token.");
invariant(!controls.includes("120ms"), "Shared controls must not retain a competing 120ms transition literal.");

invariant(
  interactions.includes("function motionDurationMs(propertyName, fallbackMs) {"),
  "The universal control runtime must expose one CSS-duration reader for synchronized runtime timers.",
);
invariant(
  interactions.includes("motionDurationMs,"),
  "The global motion-duration reader must be exposed to feature runtimes.",
);

invariant(
  staticUi.includes('cssDurationMs("--mfl-motion-tooltip", 170)'),
  "Global tooltip teardown timing must resolve from the tooltip motion token.",
);
invariant(
  !staticUi.includes("durationMs: 170"),
  "Global tooltip teardown must not retain a competing direct duration value.",
);

invariant(
  selectionStack.includes('motionDurationMs?.("--mfl-motion-slow", 220) ?? 220'),
  "Selection Stack teardown timing must resolve from the slow motion token.",
);
invariant(
  !selectionStack.includes("const EXIT_MS = 220;"),
  "Selection Stack must not retain a competing hard-coded exit duration.",
);

console.log("Global motion timing contract validation passed for shared controls and synchronized runtime timers.");
