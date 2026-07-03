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