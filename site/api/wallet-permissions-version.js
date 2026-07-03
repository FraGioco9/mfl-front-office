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

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

async function supabasePermissionMetadata() {
  const config = supabaseConfig();

  if (!config) {
    return null;
  }

  const response = await fetch(`${config.url}/rest/v1/wallet_permissions?select=updated_at&order=updated_at.desc&limit=1`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with ${response.status}: ${await response.text()}`);
  }

  const rows = await response.json();
  const updatedAt = String(rows?.[0]?.updated_at || "");

  return {
    version: updatedAt ? Date.parse(updatedAt) || updatedAt : 0,
    updated_at: updatedAt,
  };
}

async function localPermissionMetadata() {
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

async function walletPermissionMetadata() {
  if (supabaseConfig()) {
    return supabasePermissionMetadata();
  }

  return localPermissionMetadata();
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.status(405).json({ version: 0, updated_at: "" });
    return;
  }

  try {
    response.status(200).json(await walletPermissionMetadata());
  } catch (error) {
    console.warn("Could not load wallet permission metadata.", error);
    response.status(200).json({ version: 0, updated_at: "" });
  }
};