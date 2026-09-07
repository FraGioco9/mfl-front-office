const { getGeneratedAt, queryRows, tableExists } = require("./_database");
const { normalizeWalletAddress } = require("./_data-auth");

const CLUB_LOGO_BASE_URL = "https://api.playmfl.com/u/clubs";

function clubLogoUrl(clubId, logoVersion) {
  const id = String(clubId || "").trim();
  if (!id) return "";
  const version = String(logoVersion || "").trim();
  return `${CLUB_LOGO_BASE_URL}/${encodeURIComponent(id)}/logo.webp${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}

function myClubsData(signedWallet) {
  const walletAddress = normalizeWalletAddress(signedWallet).toLowerCase();
  if (!walletAddress || !tableExists("runtime_clubs")) {
    return { clubs: [], generatedAt: getGeneratedAt(), source: "sqlite-runtime" };
  }

  const rows = queryRows(
    `SELECT
       club_id AS clubId,
       name,
       division,
       logo_version AS logoVersion,
       leaderboard_rank AS leaderboardRank,
       mfl_points AS nbMflPoints
     FROM runtime_clubs
     WHERE lower(owner_wallet_address) = ?
     ORDER BY
       CASE WHEN leaderboard_rank IS NULL THEN 1 ELSE 0 END,
       leaderboard_rank,
       name,
       club_id`,
    [walletAddress],
  );

  return {
    clubs: rows.map((club) => ({
      ...club,
      logoUrl: clubLogoUrl(club.clubId, club.logoVersion),
    })),
    generatedAt: getGeneratedAt(),
    source: "sqlite-runtime",
  };
}

module.exports = {
  CLUB_LOGO_BASE_URL,
  clubLogoUrl,
  myClubsData,
};
