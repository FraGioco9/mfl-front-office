import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const siteDirectory = resolve(fileURLToPath(new URL("../", import.meta.url)));
const generatedAt = "2026-09-09T00:00:00.000Z";
const browserClubLogo9001 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%23112233'/%3E%3C/svg%3E";
const browserClubLogo9002 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%23223344'/%3E%3C/svg%3E";
const testWatchlistId = "browser1";
const testPlayer = Object.freeze({
  player_id: 1,
  wallet_address: "0x2222222222222222",
  wallet_name: "Browser Agent",
  name: "Browser Player",
  listing_price: null,
  positions: "ST",
  age: 23,
  nationality: "Italy",
  retirement_years: 2,
  owned_since: 1700000000,
  player_seasons: 5,
  overall: 80,
  pace: 90,
  shooting: 82,
  passing: 74,
  dribbling: 86,
  defense: 40,
  physical: 78,
  goalkeeping: 10,
  height: 185,
  preferred_foot: "Right",
  active_contract_revenue_share: 1250,
  active_contract_nb_matches: 12,
  active_contract_club_id: "browser-club",
  active_contract_club_name: "Browser FC",
  active_contract_club_division: 2,
});
const searchColumns = [
  "player_id",
  "name",
  "positions",
  "age",
  "nationality",
  "overall",
  "wallet_address",
  "wallet_name",
  "active_contract_club_id",
  "active_contract_club_name",
  "retirement_years",
  "player_seasons",
  "active_contract_revenue_share",
];
const publicColumns = [
  "player_id",
  "wallet_address",
  "wallet_name",
  "name",
  "positions",
  "age",
  "nationality",
  "retirement_years",
  "owned_since",
  "player_seasons",
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
  "goalkeeping",
  "height",
  "preferred_foot",
  "active_contract_revenue_share",
  "active_contract_nb_matches",
  "active_contract_club_id",
  "active_contract_club_name",
  "active_contract_club_division",
];
const pageColumns = [
  "player_id",
  "wallet_address",
  "wallet_name",
  "name",
  "listing_price",
  "positions",
  "age",
  "nationality",
  "retirement_years",
  "owned_since",
  "player_seasons",
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
  "goalkeeping",
  "height",
  "preferred_foot",
  "active_contract_revenue_share",
  "active_contract_nb_matches",
  "active_contract_club_id",
  "active_contract_club_name",
  "active_contract_club_division",
];
