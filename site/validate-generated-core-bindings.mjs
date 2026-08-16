import ts from "typescript";

import { readFile } from "node:fs/promises";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const source = await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8");
const artifacts = normalizeBuiltApplicationCoreArtifacts(source);

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
if (!startApp) throw new Error("Generated shared application core is missing startApp().");
const startupReferences = collectReferences(startApp);
const eagerReferences = collectEagerTopLevelReferences(coreInfo.file);
const routeOwnedNames = new Map();

for (const [chunkName, chunkSource] of Object.entries(artifacts.routeChunks || {})) {
  const chunkInfo = collectTopLevelDeclarations(String(chunkSource || ""), `app-core-${chunkName}-runtime.js`);
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

console.log("Generated application-core eager/startup binding audit passed.");
