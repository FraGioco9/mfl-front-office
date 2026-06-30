const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_FILE_PATTERN = /^(manifest\.json|players_\d{4}\.json)$/;
const PUBLIC_DATABASE_COLUMNS = [
  "player_id",
  "wallet_address",
  "wallet_name",
  "name",
  "positions",
  "age",
  "nationality",
  "retirement_years",
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
  "player_seasons",
  "next_overall",
  "next_overall_gap",
  "pace_to_next_overall",
  "shooting_to_next_overall",
  "passing_to_next_overall",
  "dribbling_to_next_overall",
  "defense_to_next_overall",
  "physical_to_next_overall",
];

async function findDataFile(fileName) {
  const candidates = [
    path.join(__dirname, "data-files", fileName),
    path.join(process.cwd(), "api", "data-files", fileName),
    path.join(process.cwd(), "site", "api", "data-files", fileName),
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

async function verifySupabaseToken(token) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  return response.ok;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const publicDatabase = request.query.access === "public-database";
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!publicDatabase && (!token || !(await verifySupabaseToken(token)))) {
    response.status(401).json({ error: "Login required." });
    return;
  }

  const fileName = String(request.query.file || "");

  if (!DATA_FILE_PATTERN.test(fileName)) {
    response.status(400).json({ error: "Invalid data file." });
    return;
  }

  const filePath = await findDataFile(fileName);

  if (!filePath) {
    response.status(404).json({ error: `Data file not found: ${fileName}` });
    return;
  }

  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    response.setHeader("Content-Type", "application/json; charset=utf-8");

    if (!publicDatabase) {
      response.status(200).send(fileContent);
      return;
    }

    const data = JSON.parse(fileContent);
    const publicColumns = PUBLIC_DATABASE_COLUMNS.filter((column) => data.columns.includes(column));
    const publicColumnIndexes = publicColumns.map((column) => data.columns.indexOf(column));

    if (fileName === "manifest.json") {
      response.status(200).json({ ...data, columns: publicColumns, publicAccess: "database" });
      return;
    }

    response.status(200).json({
      columns: publicColumns,
      rows: data.rows.map((row) => publicColumnIndexes.map((index) => row[index])),
    });
  } catch (error) {
    response.status(500).json({ error: `Could not read data file: ${error.message}` });
  }
};
