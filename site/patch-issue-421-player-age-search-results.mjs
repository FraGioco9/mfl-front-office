import { readFile, writeFile } from "node:fs/promises";

const replaceOnce = (source, before, after, label) => {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
};

const databasePath = new URL("./api/_database.js", import.meta.url);
let database = await readFile(databasePath, "utf8");
database = replaceOnce(
  database,
  `const SEARCH_PLAYER_COLUMNS = Object.freeze([\n  "player_id",\n  "name",\n  "overall",\n  "nationality",`,
  `const SEARCH_PLAYER_COLUMNS = Object.freeze([\n  "player_id",\n  "name",\n  "overall",\n  "age",\n  "nationality",`,
  "search payload includes player age",
);
await writeFile(databasePath, database);

const appCorePath = new URL("./modules/app-core.js", import.meta.url);
let appCore = await readFile(appCorePath, "utf8");

appCore = replaceOnce(
  appCore,
  `function buildPlayerSearchEntryFromRow(row) {`,
  `function playerSearchAgeDisplay(value) {\n  if (value === null || value === undefined || String(value).trim() === "") return "";\n  const numericAge = Number(value);\n  return Number.isFinite(numericAge) ? formatPlainValue(numericAge, "age") : "";\n}\n\nfunction buildPlayerSearchEntryFromRow(row) {`,
  "shared player search age formatter",
);

appCore = replaceOnce(
  appCore,
  `    nameDisplay,\n    nationalityRaw,\n    nationalityDisplay,\n    positionsDisplay,\n    overall: Number(statDisplayValue(row, "overall") || 0),`,
  `    nameDisplay,\n    ageDisplay: playerSearchAgeDisplay(getValue(row, "age")),\n    nationalityRaw,\n    nationalityDisplay,\n    positionsDisplay,\n    overall: Number(statDisplayValue(row, "overall") || 0),`,
  "full-row search entry carries age",
);

appCore = replaceOnce(
  appCore,
  `    nameDisplay,\n    nationalityRaw,\n    nationalityDisplay,\n    positionsDisplay,\n    overall: Number(compactSearchValue(row, columns, "overall") || 0),`,
  `    nameDisplay,\n    ageDisplay: playerSearchAgeDisplay(compactSearchValue(row, columns, "age")),\n    nationalityRaw,\n    nationalityDisplay,\n    positionsDisplay,\n    overall: Number(compactSearchValue(row, columns, "overall") || 0),`,
  "compact search entry carries age",
);

appCore = replaceOnce(
  appCore,
  `function buildAgentSearchEntry(walletAddress, name, playerCount = 0) {`,
  `function playerSearchMetadataHtml(entry, playerId) {\n  const metadata = [\n    \`OVR \${formatPlainValue(entry.overall, "overall")}\`,\n    entry.ageDisplay ? \`\${entry.ageDisplay} yo\` : "",\n    \`#\${playerId}\`,\n    entry.nationalityDisplay,\n    entry.positionsDisplay,\n  ].filter((value) => String(value || "").trim());\n  return metadata.map((value) => escapeHtml(value)).join(" &middot; ");\n}\n\nfunction buildAgentSearchEntry(walletAddress, name, playerCount = 0) {`,
  "shared player search result metadata renderer",
);

appCore = replaceOnce(
  appCore,
  `    const ovr = formatPlainValue(entry.overall, "overall");\n    button.innerHTML = \`<strong>\${escapeHtml(entry.nameDisplay)}</strong><span>OVR \${escapeHtml(ovr)} &middot; #\${escapeHtml(playerId)} &middot; \${escapeHtml(entry.nationalityDisplay)} &middot; \${escapeHtml(entry.positionsDisplay)}</span>\`;`,
  `    button.innerHTML = \`<strong>\${escapeHtml(entry.nameDisplay)}</strong><span>\${playerSearchMetadataHtml(entry, playerId)}</span>\`;`,
  "Evaluation search uses shared player metadata",
);

appCore = replaceOnce(
  appCore,
  `    const ovr = formatPlainValue(entry.overall, "overall");\n    button.dataset.searchKey = recentPlayerKey(id);\n    button.innerHTML = \`<strong>\${escapeHtml(entry.nameDisplay)}</strong><span>OVR \${escapeHtml(ovr)} &middot; #\${escapeHtml(id)} &middot; \${escapeHtml(entry.nationalityDisplay)} &middot; \${escapeHtml(entry.positionsDisplay)}</span>\`;`,
  `    button.dataset.searchKey = recentPlayerKey(id);\n    button.innerHTML = \`<strong>\${escapeHtml(entry.nameDisplay)}</strong><span>\${playerSearchMetadataHtml(entry, id)}</span>\`;`,
  "Global Search uses shared player metadata",
);

await writeFile(appCorePath, appCore);

const validatorPath = new URL("./validate-search-player-age.mjs", import.meta.url);
const validatorSource = [
  'import { readFile } from "node:fs/promises";',
  '',
  'const read = (path) => readFile(new URL(path, import.meta.url), "utf8");',
  'const invariant = (condition, message) => {',
  '  if (!condition) throw new Error(message);',
  '};',
  '',
  'const [database, dataViews, appCore] = await Promise.all([',
  '  read("./api/_database.js"),',
  '  read("./api/_data-views.js"),',
  '  read("./modules/app-core.js"),',
  ']);',
  '',
  'invariant(',
  '  database.includes(`const SEARCH_PLAYER_COLUMNS = Object.freeze([\\n  "player_id",\\n  "name",\\n  "overall",\\n  "age",`)',
  '    && dataViews.includes("const columns = SEARCH_PLAYER_COLUMNS;")',
  '    && dataViews.includes("const playerColumns = SEARCH_PLAYER_COLUMNS;"),',
  '  "Typed and recent Player search payloads must include age through the canonical SEARCH_PLAYER_COLUMNS contract.",',
  ');',
  '',
  'invariant(',
  '  appCore.includes("function playerSearchAgeDisplay(value) {")',
  '    && appCore.includes(`ageDisplay: playerSearchAgeDisplay(getValue(row, "age")),`)',
  '    && appCore.includes(`ageDisplay: playerSearchAgeDisplay(compactSearchValue(row, columns, "age")),`)',
  '    && appCore.includes("function playerSearchMetadataHtml(entry, playerId) {")',
  '    && appCore.includes("entry.ageDisplay ?")',
  '    && appCore.includes(" yo"),',
  '  "Full-row and compact Player search entries must normalize age once and expose it through the shared metadata renderer.",',
  ');',
  '',
  'invariant(',
  '  appCore.includes("playerSearchMetadataHtml(entry, playerId)")',
  '    && appCore.includes("playerSearchMetadataHtml(entry, id)"),',
  '  "Evaluation Search and Global Search must render Player age through the same canonical metadata formatter.",',
  ');',
  '',
  'const metadataStart = appCore.indexOf("function playerSearchMetadataHtml(entry, playerId)");',
  'const metadataEnd = appCore.indexOf("function buildAgentSearchEntry", metadataStart);',
  'const metadataSource = metadataStart >= 0 && metadataEnd > metadataStart ? appCore.slice(metadataStart, metadataEnd) : "";',
  'invariant(',
  '  metadataSource && !metadataSource.includes("fetch("),',
  '  "Player age search rendering must reuse the existing search payload and must not introduce a per-result age request.",',
  ');',
  '',
  'console.log("Player search age validation passed: typed and recent payloads include age, and Global/Evaluation Player results share one age metadata renderer without extra requests.");',
  '',
].join("\n");
await writeFile(validatorPath, validatorSource);

const domainPath = new URL("./validate-domain-route-features.mjs", import.meta.url);
let domain = await readFile(domainPath, "utf8");
domain = replaceOnce(
  domain,
  `  "validate-global-search-results.mjs",\n  "validate-global-search-open-lifecycle.mjs",`,
  `  "validate-global-search-results.mjs",\n  "validate-search-player-age.mjs",\n  "validate-global-search-open-lifecycle.mjs",`,
  "route-features domain includes Player search age regression",
);
await writeFile(domainPath, domain);
