const fs = require("node:fs/promises");
const path = require("node:path");

const VERSION = "1.120.37";
const DATA_FILE = "players_mfl_public.json";
const MAX_PAGE_SIZE = 2500;

async function findFile(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next deployment/local path.
    }
  }
  return null;
}

function requestOrigin(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  if (!host) return "";
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}

async function loadDataset(request) {
  const filePath = await findFile([
    path.join(__dirname, "data-files", DATA_FILE),
    path.join(__dirname, "..", "data", DATA_FILE),
    path.join(process.cwd(), "api", "data-files", DATA_FILE),
    path.join(process.cwd(), "data", DATA_FILE),
    path.join(process.cwd(), "site", "api", "data-files", DATA_FILE),
    path.join(process.cwd(), "site", "data", DATA_FILE),
  ]);

  if (filePath) {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  }

  const origin = requestOrigin(request);
  if (!origin) throw new Error(`Data file not found: ${DATA_FILE}`);
  const response = await fetch(`${origin}/data/${encodeURIComponent(DATA_FILE)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Data file not found: ${DATA_FILE}`);
  return response.json();
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  response.setHeader("CDN-Cache-Control", "no-store, max-age=0");
  response.setHeader("Vercel-CDN-Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("X-MFL-Stats-Version", VERSION);

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const data = await loadDataset(request);
    const columns = Array.isArray(data?.columns) ? data.columns : [];
    const allRows = Array.isArray(data?.rows) ? data.rows : [];
    if (!columns.length || !Array.isArray(allRows)) {
      throw new Error("The complete MFL Stats dataset is invalid.");
    }

    const pageSize = Math.min(MAX_PAGE_SIZE, positiveInteger(request.query?.pageSize, 2000));
    const totalRows = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const page = Math.min(totalPages, positiveInteger(request.query?.page, 1));
    const start = (page - 1) * pageSize;

    response.status(200).json({
      columns,
      rows: allRows.slice(start, start + pageSize),
      page,
      pageSize,
      totalRows,
      sourceRows: totalRows,
      totalPages,
      generatedAt: data?.generated_at || data?.generatedAt || null,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Could not load the complete MFL Stats dataset.";
    console.error(message);
    response.status(500).json({ error: message });
  }
};
