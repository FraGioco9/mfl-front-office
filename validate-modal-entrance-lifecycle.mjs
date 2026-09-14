import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [source, runtime, loadingStyles] = await Promise.all([
  Promise.resolve(readCanonicalCoreSource("shared")),
  read("./modules/app-core-runtime.js"),
  read("./loading.css"),
]);

for (const modalSource of [source, runtime]) {
  invariant(
    modalSource.includes('modal.classList.remove("modalClosing", "modalOpen");')
      && modalSource.includes("window.requestAnimationFrame(() => {\n    window.requestAnimationFrame(() => {\n      modal.classList.add(\"modalOpen\");"),
    "Modal opening must preserve one painted closed-state frame before modalOpen is applied.",
  );
}

invariant(!loadingStyles.includes("mflInteractionBusy"), "Modal entrance transitions must not depend on a retired global operation-busy CSS owner.");

console.log("Source-owned modal first-open paint boundary remains independent from loading-state transition suppression.");
