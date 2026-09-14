


function countryCodeForNationality(nationality) {
  const countryCodes = {
    ALBANIA: "AL", ALGERIA: "DZ", ARGENTINA: "AR", AUSTRALIA: "AU", AUSTRIA: "AT",
    BELGIUM: "BE", BOSNIA_AND_HERZEGOVINA: "BA", BRAZIL: "BR", CAMEROON: "CM",
    CANADA: "CA", CAPE_VERDE_ISLANDS: "CV", CHILE: "CL", COLOMBIA: "CO", CONGO_DR: "CD",
    COSTA_RICA: "CR", COTE_D_IVOIRE: "CI", CROATIA: "HR", CURACAO: "CW", CZECH_REPUBLIC: "CZ",
    CZECHIA: "CZ", DENMARK: "DK", ECUADOR: "EC", EGYPT: "EG",
    ENGLAND: "1f3f4-e0067-e0062-e0065-e006e-e0067-e007f", FINLAND: "FI", FRANCE: "FR",
    GEORGIA: "GE", GERMANY: "DE", GHANA: "GH", HAITI: "HT", HUNGARY: "HU", IRAN: "IR",
    IRAQ: "IQ", ITALY: "IT", IVORY_COAST: "CI", JAPAN: "JP", JORDAN: "JO",
    KOREA_REPUBLIC: "KR", MEXICO: "MX", MOROCCO: "MA", NETHERLANDS: "NL", NEW_ZEALAND: "NZ",
    NIGERIA: "NG", NORWAY: "NO", PANAMA: "PA", PARAGUAY: "PY", PERU: "PE", POLAND: "PL",
    PORTUGAL: "PT", QATAR: "QA", REPUBLIC_OF_IRELAND: "IE", ROMANIA: "RO", RUSSIA: "RU",
    SAUDI_ARABIA: "SA", SCOTLAND: "1f3f4-e0067-e0062-e0073-e0063-e0074-e007f", SENEGAL: "SN",
    SERBIA: "RS", SLOVAKIA: "SK", SLOVENIA: "SI", SOUTH_AFRICA: "ZA", SOUTH_KOREA: "KR",
    SPAIN: "ES", SWEDEN: "SE", SWITZERLAND: "CH", TUNISIA: "TN", TURKEY: "TR", UKRAINE: "UA",
    UNITED_KINGDOM: "GB", UNITED_STATES: "US", UNITED_STATES_OF_AMERICA: "US", URUGUAY: "UY",
    USA: "US", UZBEKISTAN: "UZ", WALES: "1f3f4-e0067-e0062-e0077-e006c-e0073-e007f"
  };
  const countryKey = String(nationality || "")
    .toUpperCase()
    .replaceAll("&", "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return countryCodes[countryKey] || null;
}

function countryFlagHtml(nationality) {
  const code = countryCodeForNationality(nationality);
  const label = escapeHtml(formatNationality(nationality));

  if (!code) {
    return `<span class="flagText" data-tooltip="${label}" aria-label="${label}">-</span>`;
  }

  const codepoints = code.includes("-")
    ? code
    : code
      .toUpperCase()
      .split("")
      .map((character) => (127397 + character.charCodeAt(0)).toString(16))
      .join("-");
  return `<img class="flagImage" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints}.svg" alt="" data-tooltip="${label}" aria-label="${label}">`;
}

function countryFlagElement(nationality, extraClass = "") {
  if (!countryCodeForNationality(nationality)) return null;
  const template = document.createElement("template");
  template.innerHTML = countryFlagHtml(nationality);
  const flag = template.content.firstElementChild;
  if (!(flag instanceof HTMLImageElement)) return null;
  String(extraClass || "").split(/\s+/).filter(Boolean).forEach((className) => flag.classList.add(className));
  return flag;
}

function rarityColorForOverall(overall) {
  const value = Number(overall || 0);

  if (value >= 95) return "#00ffe9";
  if (value >= 85) return "#fa53ff";
  if (value >= 75) return "#0077ff";
  if (value >= 65) return "#71ff30";
  if (value >= 55) return "#ecd17f";
  return "#bebebe";
}

function playerPositionSet(row) {
  return new Set(playerPositions(row));
}

function familiarityForPosition(row, position) {
  const positions = playerPositions(row);
  const primary = positions[0];

  if (!primary) {
    return null;
  }

  if (position === primary) {
    return "primary";
  }

  if (positions.includes(position)) {
    return "secondary";
  }

  return POSITION_FAMILIARITY[primary]?.[position] || null;
}

function weightedPositionOverall(row, position, familiarity = "primary") {
  const weights = POSITION_GROUP_WEIGHTS[position];

  if (!weights || !familiarity) {
    return null;
  }

  const penalty = FAMILIARITY_PENALTIES[familiarity] || 0;
  const weighted = Object.entries(weights).reduce((total, [attribute, weight]) => {
    const raw = Number(getValue(row, attribute) || 0);
    return total + ((raw + penalty) * weight) / 100;
  }, 0);
  return Math.max(0, weighted);
}

function displayedPrimaryOverall(row) {
  const displayed = Number(statDisplayValue(row, "overall") || 0);
  const precise = Math.round(primaryPreciseOverall(row) * 100) / 100;
  const baseTarget = Math.floor(displayed) + 0.5;

  if (Math.floor(displayed) === Math.floor(precise) && Math.abs(precise - baseTarget) < 0.000001) {
    return Math.floor(displayed);
  }

  return Math.round(precise);
}

function positionRating(row, position, familiarity) {
  if (familiarity === "primary" && position === playerPositions(row)[0]) {
    return displayedPrimaryOverall(row);
  }

  const weighted = weightedPositionOverall(row, position, familiarity);
  return weighted === null ? null : Math.round(weighted);
}

function playerPositions(row) {
  return String(getValue(row, "positions") || "")
    .split(",")
    .map((position) => position.trim())
    .filter(Boolean);
}

function playerIsGoalkeeper(row) {
  return playerPositions(row)[0] === "GK";
}

function statDisplayValue(row, statColumn) {
  if (statColumn === "overall" && playerIsGoalkeeper(row)) {
    const goalkeeping = getValue(row, "goalkeeping");
    if (goalkeeping !== null && goalkeeping !== undefined && goalkeeping !== "") {
      return goalkeeping;
    }
  }
  return getValue(row, statColumn);
}

function progressionValue(row, statColumn, suffix) {
  return Number(getValue(row, `${statColumn}_${suffix}`) || 0);
}

function primaryPreciseOverall(row) {
  const primary = playerPositions(row)[0];

  if (!primary) {
    return Number(statDisplayValue(row, "overall") || 0);
  }

  const weighted = weightedPositionOverall(row, primary, "primary");
  return weighted === null ? Number(statDisplayValue(row, "overall") || 0) : weighted;
}

function nextOverallTarget(row) {
  const displayedOverall = Math.floor(Number(statDisplayValue(row, "overall") || 0));
  const target = displayedOverall + 0.5;
  const preciseOverall = Math.round(primaryPreciseOverall(row) * 100) / 100;

  return displayedOverall === Math.floor(preciseOverall) && Math.abs(preciseOverall - target) < 0.000001
    ? Math.round((target + 0.01) * 100) / 100
    : target;
}

function nextOverallGap(row) {
  return Math.max(0, nextOverallTarget(row) - primaryPreciseOverall(row));
}

function formatDecimal(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function formatRoundedUpDecimal(value, digits = 1) {
  const multiplier = 10 ** digits;
  return (Math.ceil((Number(value || 0) - Number.EPSILON) * multiplier) / multiplier).toFixed(digits);
}



function nextOverallColorClass(neededStatGain) {
  if (neededStatGain <= 1) return "easy";
  if (neededStatGain <= 2) return "medium";
  if (neededStatGain <= 3) return "hard";
  return "veryHard";
}