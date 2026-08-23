const { supabaseConfig, supabaseRequest } = require("./_supabase");

async function supabasePermissionMetadata() {
  if (!supabaseConfig()) {
    return null;
  }

  const rows = await supabaseRequest("wallet_permissions?select=updated_at&order=updated_at.desc&limit=1");
  const updatedAt = String(rows?.[0]?.updated_at || "");

  return {
    version: updatedAt ? Date.parse(updatedAt) || updatedAt : 0,
    updated_at: updatedAt,
  };
}

async function walletPermissionMetadata() {
  return supabaseConfig() ? supabasePermissionMetadata() : { version: 0, updated_at: "" };
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
