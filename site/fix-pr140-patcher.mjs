import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./patch-pr140-route-fixes.mjs", import.meta.url);
const source = await readFile(path, "utf8");
const before = '    /const ROUTE_MESSAGE_HELPERS = `function showRouteMessagePage[\\s\\S]*?\\n`;\\n\\nconst CANONICAL_PAGE_TARGET/,';
const after = '    /const ROUTE_MESSAGE_HELPERS = `function showRouteMessagePage[\\s\\S]*?`;\\n\\nconst CANONICAL_PAGE_TARGET/,';
if (source.includes(after)) process.exit(0);
if (!source.includes(before)) throw new Error("Could not locate the route-helper migration matcher.");
await writeFile(path, source.replace(before, after), "utf8");
