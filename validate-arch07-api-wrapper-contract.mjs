import { readdir, readFile, access } from "node:fs/promises";
import { invariant } from "./validation/assertions.mjs";

const root = new URL(".", import.meta.url);
const pagesDir = new URL("./pages/api/", root);
const apiDir = new URL("./api/", root);
const wrappers = (await readdir(pagesDir)).filter(name => name.endsWith(".js")).sort();

invariant(wrappers.length > 0, "ARCH-07 must find Pages API wrappers.");

for (const name of wrappers) {
  const wrapper = String(await readFile(new URL(name, pagesDir), "utf8")).replace(/\r\n?/g, "\n");
  const handlerName = `_handler-${name}`;
  await access(new URL(handlerName, apiDir));
  invariant(
    wrapper.includes(`require("../../api/${handlerName}")`),
    `Pages wrapper ${name} must forward to the canonical internal CommonJS handler ${handlerName}.`,
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

const publicTopLevelApiFiles = (await readdir(apiDir))
  .filter(name => name.endsWith(".js") && !name.startsWith("_"))
  .sort();
invariant(
  publicTopLevelApiFiles.length === 0,
  `Next must be the sole HTTP API owner; top-level api/ contains deployable handlers: ${publicTopLevelApiFiles.join(", ")}.`,
);

console.log(`ARCH-07 Pages/CommonJS wrapper contract passed for ${wrappers.length} API routes.`);
