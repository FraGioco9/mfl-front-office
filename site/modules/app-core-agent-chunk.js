// @ts-check

function extractRequiredAgentSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not split Agent application core section: ${label}.`);
  }

  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

export function splitAgentApplicationCoreRuntime(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  if (String(routeChunks.agents || "").trim()) return artifacts;

  const core = String(input.core || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot split Agent ownership from an empty application core.");
  }

  const extracted = extractRequiredAgentSection(
    core,
    '(() => {\n  const removedAgentViews = new Set(["current", "all"]);',
    "/* Public progression table views */",
    "Agent view restrictions",
  );
  const agents = extracted.chunk.replace(/\s*$/, "");
  const normalizedCore = extracted.core.replace(/\s*$/, "");
  if (!agents || !normalizedCore) {
    throw new Error("Agent application core split produced an empty artifact.");
  }

  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ ...routeChunks, agents }),
  });
}
