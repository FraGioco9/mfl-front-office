function supabaseConfig(options = {}) {
  const url = String(
    process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || "",
  ).replace(/\/+$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const allowAnonKey = options.allowAnonKey === true;
  const key = serviceRoleKey || (allowAnonKey
    ? String(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
    : "");
  return url && key ? { url, key } : null;
}

async function supabaseRequest(pathname, options = {}, configOptions = {}) {
  const config = supabaseConfig(configOptions);
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const { headers: optionHeaders, ...requestOptions } = options;
  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    ...requestOptions,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(optionHeaders || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with ${response.status}: ${await response.text()}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

module.exports = {
  supabaseConfig,
  supabaseRequest,
};
