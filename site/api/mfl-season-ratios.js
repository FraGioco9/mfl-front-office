const APP_VERSION = "1.118.5";
const APP_CHANGELOG_DESCRIPTION = "Extend the global shell to the right edge and keep version UI current";

function supabaseConfig() {
  const url = String(
    process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || "",
  ).replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

function normalizeRows(value) {
  return (Array.isArray(value) ? value : [])
    .map((row) => ({
      season: Number(row?.season),
      ratio: Number(row?.ratio),
    }))
    .filter((row) => Number.isInteger(row.season) && row.season > 0 && Number.isFinite(row.ratio) && row.ratio > 0)
    .sort((a, b) => b.season - a.season)
    .slice(0, 5);
}

function runtimeScript(rows, warning = "") {
  const serializedRows = JSON.stringify(rows);
  const serializedWarning = JSON.stringify(String(warning || ""));
  const serializedVersion = JSON.stringify(APP_VERSION);
  const serializedDescription = JSON.stringify(APP_CHANGELOG_DESCRIPTION);

  return `(() => {
  const rows = ${serializedRows};
  const warning = ${serializedWarning};
  const appVersion = ${serializedVersion};
  const changelogDescription = ${serializedDescription};
  let attempts = 0;

  function changelogItem(version, description) {
    const item = document.createElement("li");
    const versionLabel = document.createElement("span");
    const descriptionLabel = document.createElement("p");
    versionLabel.textContent = version;
    descriptionLabel.textContent = description;
    item.append(versionLabel, descriptionLabel);
    return item;
  }

  function syncVersionUi() {
    const versionLabel = "v" + appVersion;
    const footerLink = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footerLink) footerLink.textContent = "MFL Front Office " + versionLabel;

    const list = document.querySelector(".changelogList");
    if (!list) return;

    const existing = Array.from(list.querySelectorAll("li span"))
      .some((label) => String(label.textContent || "").trim() === versionLabel);
    if (existing) return;

    const minorLabel = versionLabel.replace(/\.\d+$/, "");
    const groupedSection = Array.from(list.querySelectorAll(":scope > .changelogMinorSection"))
      .find((section) => String(section.querySelector(".changelogMinorVersion")?.textContent || "").trim() === minorLabel);

    if (groupedSection) {
      const patchList = groupedSection.querySelector(".changelogPatchList");
      if (patchList) {
        patchList.prepend(changelogItem(versionLabel, changelogDescription));
        const meta = groupedSection.querySelector(".changelogMinorMeta");
        if (meta) {
          const count = patchList.children.length;
          meta.textContent = count + (count === 1 ? " patch" : " patches");
        }
      }
      return;
    }

    list.prepend(changelogItem(versionLabel, changelogDescription));
  }

  function install() {
    syncVersionUi();

    if (typeof evaluationDiscountRateValue !== "function") {
      attempts += 1;
      if (attempts < 500) window.setTimeout(install, 20);
      return;
    }

    if (warning) console.warn(warning);
    if (rows.length !== 5) return;

    const ordered = rows.slice().sort((a, b) => a.season - b.season);
    const changes = [];
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = Number(ordered[index - 1].ratio);
      const current = Number(ordered[index].ratio);
      if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current) || current <= 0) return;
      changes.push(current / previous);
    }
    if (!changes.length) return;

    const discountRate = Math.pow(
      changes.reduce((product, change) => product * change, 1),
      1 / changes.length,
    ) - 1;
    if (!Number.isFinite(discountRate)) return;

    window.mflSeasonRatios = Object.freeze(ordered.map((row) => Object.freeze({ ...row })));
    evaluationDiscountRateValue = function evaluationDiscountRateFromSupabase() {
      return discountRate;
    };

    if (typeof renderEvaluationPage === "function"
        && typeof state !== "undefined"
        && state.currentPage === "evaluation") {
      renderEvaluationPage();
    }
  }

  install();
})();\n`;
}

async function loadLatestRatios() {
  const config = supabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured for MFL season ratios.");
  }

  const response = await fetch(
    `${config.url}/rest/v1/mfl_season_ratios?select=season,ratio&order=season.desc&limit=5`,
    {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`MFL season ratio query failed with ${response.status}: ${await response.text()}`);
  }

  return normalizeRows(await response.json());
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const scriptMode = String(request.query?.format || "").toLowerCase() === "script";

  try {
    const ratios = await loadLatestRatios();
    if (ratios.length !== 5) {
      throw new Error(`Expected 5 MFL season ratios, received ${ratios.length}.`);
    }

    if (scriptMode) {
      response.setHeader("Content-Type", "application/javascript; charset=utf-8");
      response.status(200).send(runtimeScript(ratios));
      return;
    }

    response.status(200).json({ ratios });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load MFL season ratios.";
    console.warn(message);

    if (scriptMode) {
      response.setHeader("Content-Type", "application/javascript; charset=utf-8");
      response.status(200).send(runtimeScript([], `${message} Using the built-in discount-rate history.`));
      return;
    }

    response.status(500).json({ error: message });
  }
};
