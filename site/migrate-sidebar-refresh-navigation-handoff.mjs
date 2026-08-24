import { readFile, writeFile } from "node:fs/promises";

const bootstrapPath = new URL("./bootstrap-core.js", import.meta.url);
const validatorPath = new URL("./validate-loading-ownership.mjs", import.meta.url);

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Found more than one ${label}.`);
  }
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

let bootstrap = await readFile(bootstrapPath, "utf8");

bootstrap = replaceOnce(
  bootstrap,
  `    const blockedEvents = [\n      "pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu",\n      "pointerover", "pointerenter", "pointermove", "mouseover", "mouseenter", "mousemove",\n    ];`,
  `    const blockedEvents = [\n      "pointerdown", "pointerup", "pointercancel",\n      "mousedown", "mouseup", "touchstart", "touchend", "touchcancel",\n      "click", "dblclick", "auxclick", "contextmenu",\n      "pointerover", "pointerenter", "pointermove", "mouseover", "mouseenter", "mousemove",\n    ];`,
  "blocked interaction event list",
);

bootstrap = replaceOnce(
  bootstrap,
  `    const activeTokens = new Map();\n    const subscribers = new Set();\n    let sequence = 0;\n    let interactionListenersBound = false;`,
  `    const activeTokens = new Map();\n    const subscribers = new Set();\n    const deferredEndTokens = new Set();\n    const blockedPointerIds = new Set();\n    let fallbackMouseGestureBlocked = false;\n    let fallbackTouchGestureBlocked = false;\n    let sequence = 0;\n    let interactionListenersBound = false;`,
  "interaction controller state",
);

bootstrap = replaceOnce(
  bootstrap,
  `    function end(token) {\n      if (token && activeTokens.delete(token)) applyState();\n    }\n\n    async function run(callback, reason = "loading") {`,
  `    function end(token) {\n      if (!token || !activeTokens.has(token)) return;\n      if (blockedInteractionGestureActive()) {\n        deferredEndTokens.add(token);\n        return;\n      }\n      if (activeTokens.delete(token)) applyState();\n    }\n\n    async function run(callback, reason = "loading") {`,
  "loading interaction token release",
);

bootstrap = replaceOnce(
  bootstrap,
  `    function eventTargetsBusyScrollSurface(event) {\n      if (!scrollGestureEvents.has(event.type)) return false;\n      const target = event.target instanceof Element ? event.target : null;\n      return Boolean(target?.closest(busyScrollSurfaceSelector));\n    }\n\n    function blockInteraction(event) {\n      if (!activeTokens.size || eventTargetsBusyScrollSurface(event)) return;\n      event.preventDefault();\n      event.stopImmediatePropagation();\n    }`,
  `    function pointerEventsSupported() {\n      return typeof window.PointerEvent === "function";\n    }\n\n    function blockedInteractionGestureActive() {\n      return blockedPointerIds.size > 0 || fallbackMouseGestureBlocked || fallbackTouchGestureBlocked;\n    }\n\n    function beginBlockedInteractionGesture(event) {\n      if (event.type === "pointerdown") {\n        blockedPointerIds.add(event.pointerId);\n        return;\n      }\n      if (pointerEventsSupported()) return;\n      if (event.type === "mousedown" && event.button === 0) fallbackMouseGestureBlocked = true;\n      if (event.type === "touchstart") fallbackTouchGestureBlocked = true;\n    }\n\n    function blockedInteractionGestureEndOwned(event) {\n      if (event.type === "pointerup" || event.type === "pointercancel") {\n        return blockedPointerIds.has(event.pointerId);\n      }\n      if (pointerEventsSupported()) return false;\n      if (event.type === "mouseup") return fallbackMouseGestureBlocked;\n      if (event.type === "touchend" || event.type === "touchcancel") return fallbackTouchGestureBlocked;\n      return false;\n    }\n\n    function flushDeferredInteractionEnds() {\n      if (blockedInteractionGestureActive() || !deferredEndTokens.size) return;\n      let changed = false;\n      deferredEndTokens.forEach((token) => {\n        if (activeTokens.delete(token)) changed = true;\n      });\n      deferredEndTokens.clear();\n      if (changed) applyState();\n    }\n\n    function finishBlockedInteractionGesture(event) {\n      if (event.type === "pointerup" || event.type === "pointercancel") {\n        blockedPointerIds.delete(event.pointerId);\n      } else if (!pointerEventsSupported() && event.type === "mouseup") {\n        fallbackMouseGestureBlocked = false;\n      } else if (!pointerEventsSupported() && (event.type === "touchend" || event.type === "touchcancel")) {\n        fallbackTouchGestureBlocked = Boolean(event.touches?.length);\n      }\n      flushDeferredInteractionEnds();\n    }\n\n    function clearBlockedInteractionGestures() {\n      blockedPointerIds.clear();\n      fallbackMouseGestureBlocked = false;\n      fallbackTouchGestureBlocked = false;\n      flushDeferredInteractionEnds();\n    }\n\n    function eventTargetsBusyScrollSurface(event) {\n      if (!scrollGestureEvents.has(event.type)) return false;\n      const target = event.target instanceof Element ? event.target : null;\n      return Boolean(target?.closest(busyScrollSurfaceSelector));\n    }\n\n    function blockInteraction(event) {\n      if (!activeTokens.size) return;\n      if (blockedInteractionGestureEndOwned(event)) {\n        finishBlockedInteractionGesture(event);\n        event.preventDefault();\n        event.stopImmediatePropagation();\n        return;\n      }\n      if (eventTargetsBusyScrollSurface(event)) return;\n      beginBlockedInteractionGesture(event);\n      event.preventDefault();\n      event.stopImmediatePropagation();\n    }`,
  "busy interaction blocker",
);

bootstrap = replaceOnce(
  bootstrap,
  `    function bindInteractionBlockers() {\n      if (interactionListenersBound) return;\n      interactionListenersBound = true;\n      blockedEvents.forEach((eventName) => document.addEventListener(eventName, blockInteraction, true));\n    }\n\n    function unbindInteractionBlockers() {\n      if (!interactionListenersBound) return;\n      interactionListenersBound = false;\n      blockedEvents.forEach((eventName) => document.removeEventListener(eventName, blockInteraction, true));\n    }`,
  `    function bindInteractionBlockers() {\n      if (interactionListenersBound) return;\n      interactionListenersBound = true;\n      blockedEvents.forEach((eventName) => document.addEventListener(eventName, blockInteraction, true));\n      window.addEventListener("blur", clearBlockedInteractionGestures, true);\n    }\n\n    function unbindInteractionBlockers() {\n      if (!interactionListenersBound) return;\n      interactionListenersBound = false;\n      blockedEvents.forEach((eventName) => document.removeEventListener(eventName, blockInteraction, true));\n      window.removeEventListener("blur", clearBlockedInteractionGestures, true);\n    }`,
  "interaction blocker binding",
);

await writeFile(bootstrapPath, bootstrap);

let validator = await readFile(validatorPath, "utf8");
validator = replaceOnce(
  validator,
  `  "snapshot: () => currentSnapshot,",\n]) {`,
  `  "snapshot: () => currentSnapshot,",\n  "const deferredEndTokens = new Set();",\n  "function blockedInteractionGestureActive() {",\n  "function blockedInteractionGestureEndOwned(event) {",\n  "function flushDeferredInteractionEnds() {",\n  "window.addEventListener(\\"blur\\", clearBlockedInteractionGestures, true);",\n]) {`,
  "loading owner required-contract list",
);
validator = replaceOnce(
  validator,
  `invariant(\n  bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON) await waitForRoutePaint();"),\n  "SPA route loading must remain active through the final route paint.",\n);`,
  `invariant(\n  bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON) await waitForRoutePaint();"),\n  "SPA route loading must remain active through the final route paint.",\n);\ninvariant(\n  bootstrapCore.includes('"pointerdown", "pointerup", "pointercancel"')\n    && bootstrapCore.includes('"mousedown", "mouseup", "touchstart", "touchend", "touchcancel"'),\n  "Busy interaction ownership must observe both ends of blocked pointer, mouse, and touch gestures.",\n);\ninvariant(\n  bootstrapCore.includes("if (blockedInteractionGestureActive()) {\\n        deferredEndTokens.add(token);\\n        return;\\n      }"),\n  "A loading token that settles during a blocked gesture must remain active until that gesture ends.",\n);\ninvariant(\n  bootstrapCore.includes("if (blockedInteractionGestureEndOwned(event)) {\\n        finishBlockedInteractionGesture(event);\\n        event.preventDefault();\\n        event.stopImmediatePropagation();\\n        return;\\n      }"),\n  "The refresh blocker must consume the release event for every gesture it started instead of handing half a click to sidebar navigation.",\n);\ninvariant(\n  bootstrapCore.includes('window.removeEventListener("blur", clearBlockedInteractionGestures, true);'),\n  "Blocked gesture ownership must clear safely if the window loses focus so loading cannot remain stuck.",\n);`,
  "route paint loading invariant",
);
validator = replaceOnce(
  validator,
  `console.log("Unified route loading ownership, controller-owned route reason, mixed saved-Evaluation toast suppression, loading-toast entrance, route-ready startup, background warm-up separation, shared paint boundary, static presentation, and direct subscriber validation passed.");`,
  `console.log("Unified route loading ownership, gesture-stable busy release, controller-owned route reason, mixed saved-Evaluation toast suppression, loading-toast entrance, route-ready startup, background warm-up separation, shared paint boundary, static presentation, and direct subscriber validation passed.");`,
  "loading validator completion message",
);
await writeFile(validatorPath, validator);

console.log("Migrated sidebar refresh navigation handoff ownership.");
