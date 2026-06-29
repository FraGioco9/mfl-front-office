module.exports = function handler(request, response) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();

  response.setHeader("Cache-Control", "no-store");

  if (!supabaseUrl || !supabaseAnonKey) {
    response.status(404).json({ error: "Supabase login is not configured." });
    return;
  }

  response.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
  });
};
