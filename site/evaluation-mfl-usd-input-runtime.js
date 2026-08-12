(() => {
  "use strict";

  window.__mflEvaluationMflUsdInputRuntime?.destroy?.();

  const INPUT_SELECTOR = [
    "#evaluationMflUsdInput",
    ".evaluationMflUsdInput",
    "#advancedMflUsdInput",
    ".advancedMflUsdInput",
  ].join(", ");

  function mflUsdInputFromTarget(target) {
    if (!(target instanceof HTMLInputElement)) return null;
    return target.matches(INPUT_SELECTOR) ? target : null;
  }

  function validNumericText(value) {
    return /^\d*(?:[.,]\d*)?$/.test(String(value || ""));
  }

  function sanitizeNumericText(value) {
    let result = "";
    let hasDecimal = false;
    for (const character of String(value || "")) {
      if (/\d/.test(character)) {
        result += character;
      } else if (!hasDecimal && (character === "." || character === ",")) {
        result += character;
        hasDecimal = true;
      }
    }
    return result;
  }

  function onBeforeInput(event) {
    const input = mflUsdInputFromTarget(event.target);
    if (!input || event.isComposing || !event.inputType.startsWith("insert")) return;
    if (event.data === null) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const nextValue = `${input.value.slice(0, start)}${event.data}${input.value.slice(end)}`;
    if (!validNumericText(nextValue)) event.preventDefault();
  }

  function onInput(event) {
    const input = mflUsdInputFromTarget(event.target);
    if (!input || event.isComposing || validNumericText(input.value)) return;

    const originalValue = input.value;
    const originalCaret = input.selectionStart ?? originalValue.length;
    const sanitizedValue = sanitizeNumericText(originalValue);
    const sanitizedPrefix = sanitizeNumericText(originalValue.slice(0, originalCaret));
    input.value = sanitizedValue;
    const caret = Math.min(sanitizedPrefix.length, sanitizedValue.length);
    input.setSelectionRange(caret, caret);
  }

  function prepareInputs() {
    document.querySelectorAll(INPUT_SELECTOR).forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.inputMode = "decimal";
      input.setAttribute("pattern", "[0-9]*[.,]?[0-9]*");
      input.setAttribute("autocomplete", "off");
    });
  }

  document.addEventListener("beforeinput", onBeforeInput, true);
  document.addEventListener("input", onInput, true);
  prepareInputs();
  window.addEventListener("mfl:ready", prepareInputs);

  function destroy() {
    document.removeEventListener("beforeinput", onBeforeInput, true);
    document.removeEventListener("input", onInput, true);
    window.removeEventListener("mfl:ready", prepareInputs);
  }

  window.__mflEvaluationMflUsdInputRuntime = Object.freeze({ destroy });
})();
