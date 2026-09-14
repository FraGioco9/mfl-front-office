import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const blockedStaticNames = new Set([
  "package.json",
  "package-lock.json",
  "vercel.json",
  "vercel.production.json",
  "jsconfig.json",
  "supabase-schema.sql",
]);

function queryObject(searchParams) {
  const query = {};
  for (const [key, value] of searchParams) {
    if (!(key in query)) query[key] = value;
    else if (Array.isArray(query[key])) query[key].push(value);
    else query[key] = [query[key], value];
  }
  return query;
}

function enhanceResponse(response) {
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (payload) => {
    if (!response.hasHeader("Content-Type")) {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    response.end(JSON.stringify(payload));
    return response;
  };
  response.send = (payload) => {
    if (payload === undefined || payload === null) {
      response.end();
      return response;
    }
    if (Buffer.isBuffer(payload) || typeof payload === "string" || payload instanceof Uint8Array) {
      response.end(payload);
      return response;
    }
    return response.json(payload);
  };
  return response;
}

function safeStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith(".") || blockedStaticNames.has(segment))) return "";
  const candidate = resolve(root, `.${decoded}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) return "";
  return candidate;
}

async function staticFile(pathname) {
  let candidate = safeStaticPath(pathname);
  if (!candidate) return null;
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) candidate = resolve(candidate, "index.html");
    else if (!info.isFile()) return null;
    await stat(candidate);
    return candidate;
  } catch {
    if (extname(pathname)) return null;
    return resolve(root, "index.html");
  }
}

function apiModulePath(pathname) {
  if (!pathname.startsWith("/api/")) return "";
  const route = pathname.slice("/api/".length);
  if (!/^[a-z0-9-]+$/i.test(route) || route.startsWith("_")) return "";
  const candidate = resolve(root, "api", `${route}.js`);
  return existsSync(candidate) ? candidate : "";
}

async function runApiHandler(request, response, url, modulePath) {
  request.query = queryObject(url.searchParams);
  const handler = require(modulePath);
  if (typeof handler !== "function") throw new TypeError(`API handler is not callable: ${modulePath}`);
  await handler(request, enhanceResponse(response));
}

async function requestHandler(request, response) {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    let modulePath = apiModulePath(url.pathname);
    if (!modulePath && url.pathname === "/releases.json") {
      modulePath = resolve(root, "api", "releases.js");
    } else if (!modulePath && url.pathname === "/evaluation") {
      modulePath = resolve(root, "api", "evaluation-preview.js");
    }

    if (modulePath) {
      await runApiHandler(request, response, url, modulePath);
      return;
    }

    if (!["GET", "HEAD"].includes(request.method || "GET")) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const filePath = await staticFile(url.pathname);
    if (!filePath) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    console.error("Local development request failed.", error);
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    if (!response.writableEnded) {
      response.end(JSON.stringify({ error: error?.message || "Local development request failed." }));
    }
  }
}

export function createLocalDevelopmentServer() {
  return createServer(requestHandler);
}

export function loadLocalEnvironment(path = resolve(root, ".env.local")) {
  if (!existsSync(path)) return false;
  process.loadEnvFile(path);
  return true;
}

async function main() {
  loadLocalEnvironment();
  const port = Number(process.env.PORT || 4000);
  const server = createLocalDevelopmentServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`MFL Front Office development server ready at http://localhost:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
