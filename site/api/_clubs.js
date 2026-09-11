const { getGeneratedAt, queryRows, tableExists } = require("./_database");
const { normalizeWalletAddress } = require("./_data-auth");

const CLUB_LOGO_BASE_URL = "https://d13e14gtps4iwl.cloudfront.net/u/clubs";
const FIRST_SEASON_ID = 11;
const COMPLETED_MATCH_STATUSES = Object.freeze(["ENDED", "FORFEITED"]);

function clubLogoUrl(clubId, logoVersion) {
  const id = String(clubId || "").trim();
  if (!id) return "";
  const version = String(logoVersion || "").trim();
  return `${CLUB_LOGO_BASE_URL}/${encodeURIComponent(id)}/logo.webp${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}

function parseCompetitionIds(value) {
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];
  return Array.from(new Set(parsed.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)));
}

function seasonNumber(seasonId) {
  const id = Number(seasonId);
  return Number.isInteger(id) && id >= FIRST_SEASON_ID ? id - 10 : null;
}

function standingFromRow(row) {
  const position = Number(row?.position);
  if (!Number.isInteger(position) || position <= 0) return null;
  return {
    position,
    wins: Number(row.wins) || 0,
    draws: Number(row.draws) || 0,
    losses: Number(row.losses) || 0,
    goals: Number(row.goals) || 0,
    goalsAgainst: Number(row.goalsAgainst) || 0,
    points: Number(row.points) || 0,
  };
}

function normalizedClubIds(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [values])
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  )).slice(0, 100);
}

function participationCompetitionRowsByClub(clubIds) {
  const ids = normalizedClubIds(clubIds);
  if (!ids.length || !tableExists("competitions")) return [];
  const hasStandings = tableExists("competition_standings");
  const hasMatches = tableExists("competition_matches");
  if (!hasStandings && !hasMatches) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const participationParts = [];
  const params = [];
  if (hasStandings) {
    participationParts.push(
      `SELECT club_id AS clubId, competition_id AS competitionId
       FROM competition_standings
       WHERE club_id IN (${placeholders})`,
    );
    params.push(...ids);
  }
  if (hasMatches) {
    participationParts.push(
      `SELECT home_club_id AS clubId, competition_id AS competitionId
       FROM competition_matches
       WHERE home_club_id IN (${placeholders})`,
    );
    params.push(...ids);
    participationParts.push(
      `SELECT away_club_id AS clubId, competition_id AS competitionId
       FROM competition_matches
       WHERE away_club_id IN (${placeholders})`,
    );
    params.push(...ids);
  }

  const standingFields = hasStandings
    ? "s.stage_order AS stageOrder, s.group_order AS groupOrder, s.position, s.wins, s.draws, s.losses, s.goals, s.goals_against AS goalsAgainst, s.points"
    : "NULL AS stageOrder, NULL AS groupOrder, NULL AS position, NULL AS wins, NULL AS draws, NULL AS losses, NULL AS goals, NULL AS goalsAgainst, NULL AS points";
  const standingJoin = hasStandings
    ? "LEFT JOIN competition_standings s ON s.competition_id = c.competition_id AND s.club_id = p.clubId"
    : "";

  return queryRows(
    `WITH participation AS (
       ${participationParts.join(" UNION ")}
     ),
     latest AS (
       SELECT p.clubId, MAX(c.season_id) AS seasonId
       FROM participation p
       INNER JOIN competitions c ON c.competition_id = p.competitionId
       GROUP BY p.clubId
     )
     SELECT p.clubId,
            c.competition_id AS competitionId,
            c.root_competition_id AS rootCompetitionId,
            c.season_id AS seasonId,
            c.name, c.type, c.subtype, c.status,
            ${standingFields}
     FROM participation p
     INNER JOIN latest l ON l.clubId = p.clubId
     INNER JOIN competitions c
       ON c.competition_id = p.competitionId
      AND c.season_id = l.seasonId
     ${standingJoin}
     ORDER BY p.clubId,
              CASE upper(c.type) WHEN 'LEAGUE' THEN 0 ELSE 1 END,
              c.competition_id, stageOrder DESC, groupOrder DESC`,
    params,
  );
}

function calculatedLeagueStanding(clubId, competitionId) {
  if (!tableExists("competition_matches")) return null;
  const rows = queryRows(
    `SELECT home_club_id AS homeClubId, away_club_id AS awayClubId,
            home_score AS homeScore, away_score AS awayScore
     FROM competition_matches
     WHERE competition_id = ?
       AND upper(status) IN ('ENDED', 'FORFEITED')
       AND home_club_id IS NOT NULL AND away_club_id IS NOT NULL
       AND home_score IS NOT NULL AND away_score IS NOT NULL`,
    [Number(competitionId)],
  );
  if (!rows.length) return null;

  const table = new Map();
  const stats = (value) => {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    if (!table.has(id)) table.set(id, { clubId: id, wins: 0, draws: 0, losses: 0, goals: 0, goalsAgainst: 0, points: 0 });
    return table.get(id);
  };

  rows.forEach((row) => {
    const home = stats(row.homeClubId);
    const away = stats(row.awayClubId);
    const homeScore = Number(row.homeScore);
    const awayScore = Number(row.awayScore);
    if (!home || !away || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return;
    home.goals += homeScore; home.goalsAgainst += awayScore;
    away.goals += awayScore; away.goalsAgainst += homeScore;
    if (homeScore > awayScore) { home.wins += 1; away.losses += 1; home.points += 3; }
    else if (awayScore > homeScore) { away.wins += 1; home.losses += 1; away.points += 3; }
    else { home.draws += 1; away.draws += 1; home.points += 1; away.points += 1; }
  });

  const ordered = Array.from(table.values()).sort((left, right) => (
    right.points - left.points
    || (right.goals - right.goalsAgainst) - (left.goals - left.goalsAgainst)
    || right.goals - left.goals
    || right.wins - left.wins
    || left.clubId - right.clubId
  ));
  const index = ordered.findIndex((row) => row.clubId === Number(clubId));
  return index < 0 ? null : { ...ordered[index], position: index + 1, calculatedFromMatches: true };
}

function cupStage(clubId, competitionId) {
  if (!tableExists("competition_matches")) return "";
  const hasStages = tableExists("competition_stages");
  const hasRounds = tableExists("competition_rounds");
  const stageJoin = hasStages ? "LEFT JOIN competition_stages st ON st.competition_id = m.competition_id AND st.stage_order = m.stage_order" : "";
  const roundJoin = hasRounds ? "LEFT JOIN competition_rounds r ON r.competition_id = m.competition_id AND r.stage_order = m.stage_order AND r.group_order = m.group_order AND r.round_order = m.round_order" : "";
  const stageFields = hasStages ? "st.name AS stageName, st.stage_type AS stageType" : "'' AS stageName, '' AS stageType";
  const roundField = hasRounds ? "r.name AS roundName" : "'' AS roundName";

  const rows = queryRows(
    `SELECT m.stage_order AS stageOrder, m.round_order AS roundOrder, ${stageFields}, ${roundField}
     FROM competition_matches m
     ${stageJoin}
     ${roundJoin}
     WHERE m.competition_id = ? AND (m.home_club_id = ? OR m.away_club_id = ?)
     ORDER BY m.stage_order DESC, m.round_order DESC, CAST(m.start_date AS INTEGER) DESC, m.match_id DESC
     LIMIT 1`,
    [Number(competitionId), Number(clubId), Number(clubId)],
  );
  const row = rows[0];
  if (!row) return "";
  const stage = String(row.stageName || "").trim();
  const round = String(row.roundName || "").trim();
  return String(row.stageType || "").trim().toUpperCase() === "TREE" || Number(row.stageOrder) > 0 ? (round || stage) : (stage || round);
}

function cupFinalResult(clubId, competitionId) {
  if (!tableExists("competition_matches") || !tableExists("competition_rounds")) return "";
  const rows = queryRows(
    `SELECT m.status, m.home_club_id AS homeClubId, m.away_club_id AS awayClubId,
            m.home_score AS homeScore, m.away_score AS awayScore,
            m.home_penalty_score AS homePenaltyScore, m.away_penalty_score AS awayPenaltyScore
     FROM competition_matches m
     INNER JOIN competition_rounds r
       ON r.competition_id = m.competition_id AND r.stage_order = m.stage_order
      AND r.group_order = m.group_order AND r.round_order = m.round_order
     WHERE m.competition_id = ? AND lower(trim(r.name)) IN ('final', 'finals')
       AND (m.home_club_id = ? OR m.away_club_id = ?)
     ORDER BY m.stage_order DESC, m.round_order DESC, CAST(m.start_date AS INTEGER) DESC, m.match_id DESC
     LIMIT 1`,
    [Number(competitionId), Number(clubId), Number(clubId)],
  );
  const row = rows[0];
  if (!row || !COMPLETED_MATCH_STATUSES.includes(String(row.status || "").trim().toUpperCase())) return "";

  const number = (value) => value === null || value === undefined || value === "" ? null : Number(value);
  const home = number(row.homeScore);
  const away = number(row.awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return "";

  let winner = null;
  if (home > away) winner = Number(row.homeClubId);
  else if (away > home) winner = Number(row.awayClubId);
  else {
    const homePens = number(row.homePenaltyScore);
    const awayPens = number(row.awayPenaltyScore);
    if (Number.isFinite(homePens) && Number.isFinite(awayPens)) {
      if (homePens > awayPens) winner = Number(row.homeClubId);
      else if (awayPens > homePens) winner = Number(row.awayClubId);
    }
  }
  if (!Number.isSafeInteger(winner) || winner <= 0) return "";
  return winner === Number(clubId) ? "Winner" : "Runner-up";
}

function currentCompetitionsByClub(clubIds) {
  const ids = normalizedClubIds(clubIds);
  const rows = participationCompetitionRowsByClub(ids);
  const result = Object.fromEntries(ids.map((id) => [String(id), []]));
  const seenByClub = new Map(ids.map((id) => [id, new Set()]));

  rows.forEach((row) => {
    const clubId = Number(row.clubId);
    const id = Number(row.competitionId);
    const seen = seenByClub.get(clubId);
    if (!seen || !Number.isSafeInteger(id) || id <= 0 || seen.has(id)) return;
    seen.add(id);
    const type = String(row.type || "").trim().toUpperCase();
    result[String(clubId)].push({
      competitionId: id,
      rootCompetitionId: Number.isSafeInteger(Number(row.rootCompetitionId)) ? Number(row.rootCompetitionId) : null,
      seasonId: Number.isInteger(Number(row.seasonId)) ? Number(row.seasonId) : null,
      seasonNumber: seasonNumber(row.seasonId),
      name: String(row.name || "").trim(),
      type,
      subtype: String(row.subtype || "").trim(),
      status: String(row.status || "").trim(),
      standing: type === "LEAGUE" ? (standingFromRow(row) || calculatedLeagueStanding(clubId, id)) : null,
      stage: type === "CUP" ? (cupFinalResult(clubId, id) || cupStage(clubId, id)) : "",
    });
  });
  return result;
}

function currentCompetitions(clubId) {
  return currentCompetitionsByClub([clubId])[String(Number(clubId))] || [];
}
function ownedClubRows(wallet, requestedClubIds = null) {
  if (!wallet || !tableExists("runtime_clubs")) return [];

  const columns = new Set(queryRows("PRAGMA table_info(runtime_clubs)").map((row) => String(row.name || "")));
  const select = (column, fallback, alias = column) => columns.has(column) ? `${column} AS ${alias}` : `${fallback} AS ${alias}`;
  const ids = Array.isArray(requestedClubIds)
    ? Array.from(new Set(requestedClubIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))).slice(0, 100)
    : [];
  const idFilter = ids.length ? ` AND club_id IN (${ids.map(() => "?").join(", ")})` : "";

  return queryRows(
    `SELECT club_id AS clubId, name,
            ${select("city", "''")},
            ${select("country", "''", "nation")},
            ${select("primary_color", "NULL", "primaryColor")},
            ${select("secondary_color", "NULL", "secondaryColor")},
            ${select("division", "NULL")},
            ${select("logo_version", "''", "logoVersion")},
            ${select("current_competition_ids", "'[]'", "currentCompetitionIds")}
     FROM runtime_clubs
     WHERE owner_wallet_address = ?${idFilter}
     ORDER BY CASE WHEN division BETWEEN 1 AND 10 THEN division ELSE 999 END, name, club_id`,
    [wallet, ...ids],
  );
}

function requestedClubIds(value) {
  return String(value || "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
}

function myClubsData(signedWallet) {
  const wallet = normalizeWalletAddress(signedWallet).toLowerCase();
  const clubs = ownedClubRows(wallet);
  return {
    clubs: clubs.map((club) => ({
      clubId: club.clubId,
      name: club.name,
      city: club.city,
      nation: club.nation,
      primaryColor: club.primaryColor,
      secondaryColor: club.secondaryColor,
      division: club.division,
      logoVersion: club.logoVersion,
      logoUrl: clubLogoUrl(club.clubId, club.logoVersion),
    })),
    generatedAt: getGeneratedAt(),
    source: "sqlite-runtime",
  };
}

function myClubsCompetitionsData(clubIds) {
  const requested = requestedClubIds(clubIds);
  return {
    competitionsByClub: currentCompetitionsByClub(requested),
    generatedAt: getGeneratedAt(),
    source: "sqlite-runtime",
  };
}

module.exports = { CLUB_LOGO_BASE_URL, clubLogoUrl, parseCompetitionIds, calculatedLeagueStanding, cupStage, cupFinalResult, currentCompetitions, myClubsData, myClubsCompetitionsData };
