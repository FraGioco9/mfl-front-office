// @ts-check

export function normalizeApplicationCoreSource(source, label) {
  const core = String(source || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error(`Cannot split ${label} from an empty application core.`);
  }
  return core;
}

export function normalizeSplitterInput(artifacts, chunkName, label) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  if (String(Reflect.get(routeChunks, chunkName) || "").trim()) {
    return { alreadySplit: true, routeChunks, core: "" };
  }

  const core = normalizeApplicationCoreSource(input.core, label);
  return { alreadySplit: false, routeChunks, core };
}

export function extractRequiredSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not split application core section: ${label}.`);
  }
  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

export function extractRequiredSections(source, sections) {
  let core = source;
  const chunks = [];
  for (const [startMarker, endMarker, label] of sections) {
    const extracted = extractRequiredSection(core, startMarker, endMarker, label);
    core = extracted.core;
    chunks.push(extracted.chunk);
  }
  return { core, chunks };
}

function requiredFunctionRange(source, functionName, label) {
  const asyncMarker = `async function ${functionName}(`;
  const syncMarker = `function ${functionName}(`;
  const asyncStart = source.indexOf(asyncMarker);
  const syncStart = source.indexOf(syncMarker);
  const start = asyncStart >= 0 ? asyncStart : syncStart;
  const marker = asyncStart >= 0 ? asyncMarker : syncMarker;
  const parameterStart = start >= 0 ? start + marker.length - 1 : -1;
  let parameterDepth = 0;
  let parameterEnd = -1;
  for (let index = parameterStart; index >= 0 && index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }
  const openBrace = parameterEnd >= 0 ? source.indexOf("{", parameterEnd + 1) : -1;
  if (start < 0 || openBrace < 0) {
    throw new Error(`Could not split application core function: ${label}.`);
  }

  let depth = 0;
  let end = -1;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error(`Could not find the end of application core function: ${label}.`);
  }
  return { start, end };
}

export function extractRequiredFunction(source, functionName, label = functionName) {
  const { start, end } = requiredFunctionRange(source, functionName, label);
  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

export function extractRequiredFunctions(source, functionNames, label) {
  let core = source;
  const chunks = [];
  for (const functionName of functionNames) {
    const extracted = extractRequiredFunction(core, functionName, `${label}: ${functionName}`);
    core = extracted.core;
    chunks.push(extracted.chunk);
  }
  return { core, chunks };
}

export function insertBeforeRequiredMarker(source, marker, insertion, label) {
  const index = source.indexOf(marker);
  if (index < 0) {
    throw new Error(`Could not insert application core bridge: ${label}.`);
  }
  return `${source.slice(0, index)}${insertion}\n\n${source.slice(index)}`;
}

export function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not normalize application core: ${label}.`);
  }
  return source.replace(before, after);
}

export function replaceRequiredFunction(source, functionName, replacement, label) {
  let range;
  try {
    range = requiredFunctionRange(source, functionName, label);
  } catch {
    throw new Error(`Could not normalize application core function: ${label}.`);
  }
  return `${source.slice(0, range.start)}${replacement}${source.slice(range.end)}`;
}

export function renameRequiredFunctionOwner(source, functionName, ownerName, label = functionName) {
  const asyncMarker = `async function ${functionName}(`;
  const marker = `function ${functionName}(`;
  if (source.includes(asyncMarker)) {
    return source.replace(asyncMarker, `async function ${ownerName}(`);
  }
  if (source.includes(marker)) {
    return source.replace(marker, `function ${ownerName}(`);
  }
  throw new Error(`Could not delegate application core owner: ${label}.`);
}

export function finalizeSplitArtifacts(core, routeChunks, chunkName, chunk, label) {
  const normalizedCore = String(core || "").replace(/\s*$/, "");
  const normalizedChunk = String(chunk || "").replace(/\s*$/, "");
  if (!normalizedChunk || !normalizedCore) {
    throw new Error(`${label} application core split produced an empty artifact.`);
  }
  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ ...routeChunks, [chunkName]: normalizedChunk }),
  });
}