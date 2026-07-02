const fs = require("node:fs/promises");
const path = require("node:path");

async function findFile(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next possible Vercel/local path.
    }
  }

  return null;
}

async function walletPermissionMetadata() {
  const permissionsPath = await findFile([
    path.join(__dirname, "wallet-permissions.json"),
    path.join(process.cwd(), "api", "wallet-permissions.json"),
    path.join(process.cwd(), "site", "api", "wallet-permissions.json"),
  ]);

  if (!permissionsPath) {
    return { version: 0, updated_at: "" };
  }

  try {
    const data = JSON.parse(await fs.readFile(permissionsPath, "utf8"));
    return {
      version: Number(data.version || 0),
      updated_at: String(data.updated_at || ""),
    };
  } catch {
    return { version: 0, updated_at: "" };
  }
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.status(405).json({ version: 0, updated_at: "" });
    return;
  }

  response.status(200).json(await walletPermissionMetadata());
};