import ts from "@typescript/typescript6";

import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const artifacts = Object.freeze({
  core: await read("./modules/core-sources/shared.js"),
  routeChunks: Object.freeze({
    evaluation: await read("./modules/core-sources/evaluation.js"),
    mflstats: await read("./modules/core-sources/mfl-stats.js"),
    club: await read("./modules/core-sources/club.js"),
    settings: await read("./modules/core-sources/settings.js"),
    player: await read("./modules/core-sources/player.js"),
    table: await read("./modules/core-sources/table.js"),
    wallet: await read("./modules/core-sources/wallet.js"),
    watchlist: await read("./modules/core-sources/watchlist.js"),
  }),
});

function collectBindingNames(name, output) {
  if (!name) return;
  if (ts.isIdentifier(name)) {
    output.add(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) collectBindingNames(element.name, output);
    }
  }
}

function collectTopLevelDeclarations(text, filename) {
  const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = new Set();
  for (const statement of file.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
      names.add(statement.name.text);
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(declaration.name, names);
      }
    }
  }
  return { file, names };
}

function identifierIsNonReference(node) {
  const parent = node.parent;
  if (!parent) return false;
  if ((ts.isFunctionDeclaration(parent)
      || ts.isFunctionExpression(parent)
      || ts.isClassDeclaration(parent)
      || ts.isClassExpression(parent)
      || ts.isVariableDeclaration(parent)
      || ts.isParameter(parent)
      || ts.isBindingElement(parent)) && parent.name === node) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node && !ts.isShorthandPropertyAssignment(parent)) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isLabeledStatement(parent) && parent.label === node) return true;
  if ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node) return true;
  return false;
}

function collectReferences(node) {
  const names = new Set();
  const visit = (current) => {
    if (ts.isIdentifier(current) && !identifierIsNonReference(current) && !ts.isTypeOfExpression(current.parent)) {
      names.add(current.text);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return names;
}

function immediatelyInvokedFunction(node) {
  if (!ts.isFunctionExpression(node) && !ts.isArrowFunction(node)) return false;
  let expression = node;
  let parent = node.parent;
  while (parent && ts.isParenthesizedExpression(parent)) {
    expression = parent;
    parent = parent.parent;
  }
  return Boolean(parent && ts.isCallExpression(parent) && parent.expression === expression);
}

function collectEagerTopLevelReferences(file) {
  const names = new Set();
  const visit = (current) => {
    if (ts.isFunctionLike(current) && !immediatelyInvokedFunction(current)) return;
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) return;
    if (ts.isIdentifier(current) && !identifierIsNonReference(current) && !ts.isTypeOfExpression(current.parent)) {
      names.add(current.text);
    }
    ts.forEachChild(current, visit);
  };

  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) continue;
    visit(statement);
  }
  return names;
}

const coreInfo = collectTopLevelDeclarations(artifacts.core, "app-core-runtime.js");
const startApp = coreInfo.file.statements.find((statement) => (
  ts.isFunctionDeclaration(statement) && statement.name?.text === "startApp"
));
if (!startApp) throw new Error("Canonical shared application core is missing startApp().");
const startupReferences = collectReferences(startApp);
const eagerReferences = collectEagerTopLevelReferences(coreInfo.file);
const routeOwnedNames = new Map();
const routeChunkInfo = new Map();

for (const [chunkName, chunkSource] of Object.entries(artifacts.routeChunks || {})) {
  const chunkInfo = collectTopLevelDeclarations(String(chunkSource || ""), `app-core-${chunkName}-runtime.js`);
  routeChunkInfo.set(chunkName, chunkInfo);
  for (const name of chunkInfo.names) {
    if (!routeOwnedNames.has(name)) routeOwnedNames.set(name, []);
    routeOwnedNames.get(name).push(chunkName);
  }
}

const unresolved = [];
for (const [name, owners] of routeOwnedNames) {
  if (coreInfo.names.has(name)) continue;
  const contexts = [];
  if (eagerReferences.has(name)) contexts.push("eager");
  if (startupReferences.has(name)) contexts.push("startApp");
  if (!contexts.length) continue;
  unresolved.push(`${name} [${owners.join(", ")}; ${contexts.join("+")}]`);
}

if (unresolved.length) {
  throw new Error(`Application startup references lazy route-owned identifiers without a facade: ${unresolved.sort().join("; ")}`);
}

const allowedChunkDependencies = new Map([
  ["club", new Set(["table"])],
  ["watchlist", new Set(["table"])],
]);
const crossChunkReferences = [];
for (const [chunkName, chunkInfo] of routeChunkInfo) {
  const references = collectReferences(chunkInfo.file);
  const allowedOwners = allowedChunkDependencies.get(chunkName) || new Set();
  for (const [name, owners] of routeOwnedNames) {
    if (!references.has(name) || coreInfo.names.has(name) || chunkInfo.names.has(name)) continue;
    const foreignOwners = owners.filter((owner) => owner !== chunkName);
    if (!foreignOwners.length || foreignOwners.every((owner) => allowedOwners.has(owner))) continue;
    crossChunkReferences.push(`${chunkName} -> ${name} [${foreignOwners.join(", ")}]`);
  }
}

if (crossChunkReferences.length) {
  throw new Error(`Canonical route cores reference undeclared lazy dependencies: ${crossChunkReferences.sort().join("; ")}`);
}

console.log("Canonical application-core eager/startup and route dependency audit passed.");
