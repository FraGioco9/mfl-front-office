import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [playerSource, generatedPlayer] = await Promise.all([
  read("./modules/core-sources/player.js"),
  read("./modules/app-core-player-runtime.js"),
]);

const neutralUnknownShell = 'if (!context.positions.length) return ["overall"];';
const rawPositionFallback = 'normalizePositions(knownValues.positions?.display || knownValues.positions?.raw || "")';
const staticGridAdoption = 'existingGrid.dataset.mflStaticPlayerGrid === "true"';
invariant(playerSource.includes(neutralUnknownShell), "Canonical Player loading must not assume outfield Attributes when positions are unknown.");
invariant(generatedPlayer.includes(neutralUnknownShell), "Generated Player runtime must retain the neutral Overall-only unknown-position Attributes shell.");
invariant(playerSource.includes(rawPositionFallback), "Canonical Player loading must preserve cached raw positions instead of briefly losing the correct Attribute labels.");
invariant(generatedPlayer.includes(rawPositionFallback), "Generated Player runtime must preserve cached raw positions instead of briefly losing the correct Attribute labels.");
invariant(playerSource.includes(staticGridAdoption), "Canonical Player loading must adopt the parser-owned grid until authoritative data replaces it once.");
invariant(generatedPlayer.includes(staticGridAdoption), "Generated Player runtime must adopt the parser-owned grid until authoritative data replaces it once.");
const neutralStructuralShell = 'const structuralColumns = context.positions.length ? columns : ["overall", "", "", "", "", "", ""];';
invariant(playerSource.includes(neutralStructuralShell), "Canonical Player loading must reserve stable unlabeled Attribute slots without guessing a player type.");
invariant(generatedPlayer.includes(neutralStructuralShell), "Generated Player runtime must reserve the same stable unlabeled Attribute slots while position is unknown.");

console.log("Player unknown-position loading shell stays neutral until the player type is known.");
