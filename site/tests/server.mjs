import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function releaseHistory() {
  const release = JSON.parse(await readFile(resolve(root, "release.json"), "utf8"));
  const history = JSON.parse(await readFile(resolve(root, "api/_data/releases-history.json"), "utf8"));
  const label = `v${release.version}`;
  return [[label, release.description], ...history.filter((entry) => Array.isArray(entry) && entry[0] !== label)];
}

async function serveFile(response, pathname) {
  const candidate = resolve(root, `.${pathname}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    sendJson(response, { error: "Invalid path." }, 400);
    return;
  }

  try {
    const content = await readFile(candidate);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extname(candidate)) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch {
    sendJson(response, { error: "Not found." }, 404);
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  if (url.pathname === "/releases.json" || url.pathname === "/api/releases") {
    sendJson(response, await releaseHistory());
    return;
  }

  if (url.pathname === "/api/data") {
    sendJson(response, {
      manifest: { schemaVersion: 1 },
      summary: { playerCount: 0, walletCount: 0, generatedAt: "2026-08-07T00:00:00.000Z" },
      rows: [],
      columns: [],
    });
    return;
  }

  if (url.pathname === "/api/mfl-season-ratios-v2") {
    sendJson(response, {
      ratios: [
        { season: 15, ratio: 412 },
        { season: 14, ratio: 425 },
        { season: 13, ratio: 438 },
        { season: 12, ratio: 450 }
      ],
      source: "test",
      requestedAt: "2026-08-07T00:00:00.000Z"
    });
    return;
  }

  if (url.pathname === "/api/test") {
    sendJson(response, { accept: request.headers.accept || "" });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, {});
    return;
  }

  const hasExtension = Boolean(extname(url.pathname));
  if (url.pathname === "/") {
    await serveFile(response, "/index.html");
    return;
  }
  if (hasExtension) {
    await serveFile(response, url.pathname);
    return;
  }
  await serveFile(response, "/index.html");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MFL test server listening on http://127.0.0.1:${port}`);
});
