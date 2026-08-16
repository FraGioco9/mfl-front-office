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

function identifierIsDeclaration(node) {
  const parent = node.parent;
  if (!parent) return false;
  if ((ts.isFunctionDeclaration(parent)
      || ts.isFunctionExpression(parent)
      || ts.isClassDeclaration(parent)
      || ts.isClassExpression(parent)
      || ts.isVariableDeclaration(parent)
      || ts.isParameter(parent)
      || ts.isBindingElement(parent)) && parent.name === node) return true;
  if ((ts.isMethodDeclaration(parent)
      || ts.isPropertyDeclaration(parent)
      || ts.isPropertySignature(parent)
      || ts.isMethodSignature(parent)
      || ts.isGetAccessorDeclaration(parent)
      || ts.isSetAccessorDeclaration(parent)) && parent.name === node) return true;
  return false;
}

function identifierIsNonReference(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (identifierIsDeclaration(node)) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node && !ts.isShorthandPropertyAssignment(parent)) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isLabeledStatement(parent) && parent.label === node) return true;
  if ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node) return true;
  return false;
}

function collectReferences(file) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) && !identifierIsNonReference(node)) {
      if (!(ts.isTypeOfExpression(node.parent))) names.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

const coreInfo = collectTopLevelDeclarations(artifacts.core, "app-core-runtime.js");
const coreReferences = collectReferences(coreInfo.file);
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
  if (!coreReferences.has(name) || coreInfo.names.has(name)) continue;
  unresolved.push(`${name} [${owners.join(", ")}]`);
}

if (unresolved.length) {
  throw new Error(`Shared application core still references route-owned identifiers without a facade: ${unresolved.sort().join("; ")}`);
}

console.log("Generated application-core route binding audit passed.");
