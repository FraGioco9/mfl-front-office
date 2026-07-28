const fs = require("node:fs/promises");
const path = require("node:path");
const Module = require("node:module");

let handlerPromise = null;

async function findOriginalHandler() {
  const candidates = [
    path.join(__dirname, "data.js"),
    path.join(process.cwd(), "api", "data.js"),
    path.join(process.cwd(), "site", "api", "data.js"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next Vercel/local path.
    }
  }

  throw new Error("Original data handler was not found.");
}

async function loadPatchedHandler() {
  if (handlerPromise) {
    return handlerPromise;
  }

  handlerPromise = (async () => {
    const filename = await findOriginalHandler();
    const originalSource = await fs.readFile(filename, "utf8");
    const originalBlock = [
      '    const retirementYears = Number(valueFromRow(row, columns, "retirement_years"));',
      '    const playerSeasons = Number(valueFromRow(row, columns, "player_seasons"));',
    ].join("\n");
    const correctedBlock = [
      '    const retirementValue = valueFromRow(row, columns, "retirement_years");',
      '    const retirementYears = isBlankValue(retirementValue) ? null : Number(retirementValue);',
      '    const playerSeasonsValue = valueFromRow(row, columns, "player_seasons");',
      '    const playerSeasons = isBlankValue(playerSeasonsValue) ? null : Number(playerSeasonsValue);',
    ].join("\n");

    if (!originalSource.includes(originalBlock)) {
      throw new Error("The paged-player normalization block could not be patched safely.");
    }

    const patchedSource = originalSource.replace(originalBlock, correctedBlock);
    const compiledModule = new Module(filename, module);
    compiledModule.filename = filename;
    compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
    compiledModule._compile(patchedSource, filename);

    if (typeof compiledModule.exports !== "function") {
      throw new Error("The patched data handler did not export a function.");
    }

    return compiledModule.exports;
  })().catch((error) => {
    handlerPromise = null;
    throw error;
  });

  return handlerPromise;
}

module.exports = async function safeDataHandler(request, response) {
  try {
    const handler = await loadPatchedHandler();
    return await handler(request, response);
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    response.status(500).json({
      error: `Could not load requested data: ${error.message}`,
    });
  }
};
