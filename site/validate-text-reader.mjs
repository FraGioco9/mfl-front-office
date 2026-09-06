import { invariant } from "./validation/assertions.mjs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  clearValidationTextCache,
  normalizeValidationText,
  readValidationText,
  readValidationTextSync,
} from "./validation-text.mjs";


invariant(normalizeValidationText("first\r\nsecond\rthird\n") === "first\nsecond\nthird\n", "Validation text normalization must normalize CRLF and CR to LF.");

const directory = await mkdtemp(join(tmpdir(), "mfl-validator-reader-"));
const file = join(directory, "sample.txt");
const fileUrl = pathToFileURL(file);
try {
  await writeFile(file, "first\r\nsecond\r\n", "utf8");
  clearValidationTextCache();
  invariant(await readValidationText(fileUrl) === "first\nsecond\n", "Async validation reads must normalize line endings.");
  invariant(readValidationTextSync(fileUrl) === "first\nsecond\n", "Sync validation reads must normalize line endings.");

  await writeFile(file, "updated\r\n", "utf8");
  invariant(await readValidationText(fileUrl) === "first\nsecond\n", "Validation reader must cache immutable repository reads within a validator process.");
  clearValidationTextCache();
  invariant(await readValidationText(fileUrl) === "updated\n", "Clearing the validation cache must expose updated content.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("Explicit validation text reader normalization and caching passed.");
