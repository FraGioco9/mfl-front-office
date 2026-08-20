import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "mfl-validator-eol-"));
const file = join(directory, "crlf.txt");

try {
  await writeFile(file, "first\r\nsecond\r\n", "utf8");
  const normalized = await readFile(file, "utf8");
  if (normalized !== "first\nsecond\n") {
    throw new Error("Validator text reads must normalize CRLF and CR to LF.");
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("Validator text reads normalize platform line endings to LF.");
