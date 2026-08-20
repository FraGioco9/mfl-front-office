import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

const normalizeTextLineEndings = (value) =>
  typeof value === "string" ? value.replace(/\r\n?/g, "\n") : value;

const originalReadFileSync = fs.readFileSync.bind(fs);
const originalReadFile = fsPromises.readFile.bind(fsPromises);

fs.readFileSync = (...args) => normalizeTextLineEndings(originalReadFileSync(...args));
fsPromises.readFile = async (...args) => normalizeTextLineEndings(await originalReadFile(...args));

syncBuiltinESMExports();
