import { readdir, readFile, access } from "node:fs/promises";
import { invariant } from "./validation/assertions.mjs";

const root = new URL(".", import.meta.url);
const pagesDir = new URL("./pages/api/", root);
const apiDir = new URL("./api/", root);
const wrappers = (await readdir(pagesDir)).filter(name => name.endsWith(".js")).sort();

invariant(wrappers.length > 0, "ARCH-07 must find Pages API wrappers.");

for (const name of wrappers) {
  const wrapper = String(await readFile(new URL(name, pagesDir), "utf8")).replace(/\r\n?/g, "\n");
  await access(new URL(name, apiDir));
  invariant(
    wrapper.includes(`require("../../api/${name}")`),
    `Pages wrapper ${name} must forward to the same-named canonical CommonJS handler.`,
  );
  invariant(
    wrapper.includes("export const config = { api: { bodyParser: false } };"),
    `Pages wrapper ${name} must keep Next body parsing disabled so the canonical handler owns limits/parsing.`,
  );
  invariant(
    wrapper.includes("export default handler;"),
    `Pages wrapper ${name} must export only the canonical handler.`,
  );
  invariant(
    !/setHeader\s*\(|res\.|req\.|cookie|Server-Timing|trace|request[-_ ]?id/i.test(
      wrapper.replace(/^\/\/.*$/gm, ""),
    ),
    `Pages wrapper ${name} must not duplicate response, cookie or tracing behavior.`,
  );
}

const apiFiles = (await readdir(apiDir))
  .filter(name => name.endsWith(".js") && !name.startsWith("_"))
  .sort();
const wrapperSet = new Set(wrappers);
const intentionallyInternal = new Set([]);
const missing = apiFiles.filter(name => !wrapperSet.has(name) && !intentionallyInternal.has(name));
invariant(
  missing.length === 0,
  `Canonical public API handlers need same-named Pages wrappers: ${missing.join(", ")}.`,
);

console.log(`ARCH-07 Pages/CommonJS wrapper contract passed for ${wrappers.length} API routes.`);
