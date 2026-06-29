const fs = require("node:fs/promises");
const path = require("node:path");

async function findManifestFile() {
  const candidates = [
    path.join(__dirname, "data-files", "manifest.json"),
    path.join(process.cwd(), "api", "data-files", "manifest.json"),
    path.join(process.cwd(), "site", "api", "data-files", "manifest.json"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next possible Vercel function location.
    }
  }

  return null;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const manifestPath = await findManifestFile();

  if (!manifestPath) {
    response.status(404).json({ error: "Website summary not found." });
    return;
  }

  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    response.status(200).json({
      playerCount: manifest.row_count || 0,
      walletCount: manifest.wallet_count || 0,
      generatedAt: manifest.generated_at || null,
    });
  } catch (error) {
    response.status(500).json({ error: `Could not read website summary: ${error.message}` });
  }
};
