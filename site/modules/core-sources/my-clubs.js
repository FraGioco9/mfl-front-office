(() => {
  "use strict";

  if (Reflect.get(window, "__mflMyClubsRoute")) return;

  const PAGE = "my-clubs";
  const COUNT_STORAGE_KEY = "mfl-my-clubs-count-v2";
  const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";
  const CLUB_REQUEST_TIMEOUT_MS = 10_000;
  const COMPETITION_REQUEST_TIMEOUT_MS = 15_000;
  const page = document.getElementById("myClubsPage");
  const grid = document.getElementById("myClubsGrid");
  const status = document.getElementById("myClubsStatus");
  const retryButton = document.getElementById("myClubsRetryButton");

  let cachedWallet = "";
  let cachedClubs = [];
  let cacheReady = false;
  let competitionsReady = false;
  let requestSequence = 0;
  let competitionSequence = 0;
  let inFlight = null;
  let competitionInFlight = null;

  function activeWallet() {
    return normalizeWalletAddress(state.linkedWalletAddress || "").toLowerCase();
  }

  function pageActive() {
    return state.currentPage === PAGE
      && document.body?.dataset.page === PAGE
      && page instanceof HTMLElement
      && page.hidden === false;
  }

  function setBusy(busy) {
    if (grid) grid.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function setStatus(message = "", error = false) {
    if (!(status instanceof HTMLElement)) return;
    status.textContent = String(message || "");
    status.hidden = !message;
    status.classList.toggle("error", Boolean(error));
  }

  function storedCount(wallet) {
    const normalizedWallet = normalizeWalletAddress(wallet || "").toLowerCase();
    if (!normalizedWallet) return 0;
    try {
      const stored = JSON.parse(localStorage.getItem(COUNT_STORAGE_KEY) || "{}");
      const count = Number(stored?.[normalizedWallet]);
      return Number.isInteger(count) && count > 0 ? count : 0;
    } catch {
      return 0;
    }
  }

  function saveCount(wallet, count) {
    const normalizedWallet = normalizeWalletAddress(wallet || "").toLowerCase();
    const normalizedCount = Number(count);
    if (!normalizedWallet || !Number.isInteger(normalizedCount) || normalizedCount < 0) return;
    try {
      const current = JSON.parse(localStorage.getItem(COUNT_STORAGE_KEY) || "{}");
      const next = current && typeof current === "object" && !Array.isArray(current) ? current : {};
      next[normalizedWallet] = normalizedCount;
      localStorage.setItem(COUNT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Loading geometry persistence is optional.
    }
  }

  function loadingCompetitionList() {
    const competitions = document.createElement("div");
    competitions.className = "myClubCompetitions myClubCompetitionsLoading";
    competitions.dataset.competitionState = "loading";
    for (let index = 0; index < 2; index += 1) {
      const row = document.createElement("div");
      row.className = "myClubCompetition myClubCompetitionLoading";
      const competition = document.createElement("span");
      competition.className = "myClubCompetitionName myClubLoadingLine myClubLoadingCompetitionName";
      const position = document.createElement("span");
      position.className = "myClubCompetitionStanding myClubLoadingLine myClubLoadingCompetitionStanding";
      row.append(competition, position);
      competitions.appendChild(row);
    }
    return competitions;
  }

  function skeletonCard() {
    const card = document.createElement("div");
    card.className = "myClubCard myClubCardLoading";
    card.setAttribute("aria-hidden", "true");

    const logoFrame = document.createElement("div");
    logoFrame.className = "myClubLogoFrame myClubLogoFrameLoading";
    const logo = document.createElement("div");
    logo.className = "myClubLogo myClubLoadingLogo";
    logoFrame.appendChild(logo);

    const body = document.createElement("div");
    body.className = "myClubCardBody";
    const titleBlock = document.createElement("div");
    titleBlock.className = "myClubTitleBlock";
    const idLine = document.createElement("span");
    idLine.className = "myClubId myClubLoadingLine myClubLoadingId";
    const nameLine = document.createElement("span");
    nameLine.className = "myClubName myClubLoadingLine myClubLoadingName";
    titleBlock.append(idLine, nameLine);

    const meta = document.createElement("div");
    meta.className = "myClubMeta myClubMetaLoading";
    const divisionLine = document.createElement("span");
    divisionLine.className = "myClubDivision myClubLoadingLine myClubLoadingDivision";
    const locationLine = document.createElement("span");
    locationLine.className = "myClubLocation myClubLoadingLine myClubLoadingLocation";
    meta.append(divisionLine, locationLine);

    body.append(titleBlock, meta, loadingCompetitionList());
    card.append(logoFrame, body);
    return card;
  }

  function renderSkeletons(wallet = activeWallet()) {
    if (!(grid instanceof HTMLElement)) return;
    const count = Math.max(1, storedCount(wallet));
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) fragment.appendChild(skeletonCard());
    grid.replaceChildren(fragment);
    setBusy(true);
    setStatus("");
    if (retryButton) retryButton.hidden = true;
  }

  function clear() {
    requestSequence += 1;
    competitionSequence += 1;
    cachedWallet = "";
    cachedClubs = [];
    cacheReady = false;
    competitionsReady = false;
    inFlight = null;
    competitionInFlight = null;
    if (grid) grid.replaceChildren();
    setBusy(false);
    setStatus("");
    if (retryButton) retryButton.hidden = true;
  }

  function safeColor(value) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/iu.test(color) ? color.toLowerCase() : "";
  }

  function countryLabel(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text === text.toUpperCase() || text === text.toLowerCase()
      ? text.toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
      : text;
  }

  function ordinal(value) {
    const position = Number(value);
    if (!Number.isInteger(position) || position <= 0) return "";
    const mod100 = position % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
    return `${position}${({ 1: "st", 2: "nd", 3: "rd" }[position % 10] || "th")}`;
  }

  function detailLabel(competition) {
    const type = String(competition?.type || "").trim().toUpperCase();
    if (type === "LEAGUE") return ordinal(competition?.standing?.position);
    if (type === "CUP") return String(competition?.stage || "").trim();
    return "";
  }

  function medalTier(competition, label) {
    const type = String(competition?.type || "").trim().toUpperCase();
    if (type === "LEAGUE") {
      const position = Number(competition?.standing?.position);
      return position === 1 ? "gold" : position === 2 ? "silver" : position === 3 ? "bronze" : "";
    }
    if (type !== "CUP") return "";
    const normalized = String(label || "").trim().toLowerCase().replace(/[\s_-]+/gu, "");
    if (normalized === "winner") return "gold";
    if (normalized === "runnerup" || normalized === "final" || normalized === "finals") return "silver";
    if (normalized === "semifinal" || normalized === "semifinals") return "bronze";
    return "";
  }

  function saveClubDestination(clubId, name, divisionInfo) {
    if (!clubId || !name) return;
    try {
      const stored = JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY) || "{}");
      const next = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
      next[clubId] = {
        clubId,
        name,
        divisionName: String(divisionInfo?.name || ""),
        divisionColor: String(divisionInfo?.color || ""),
      };
      localStorage.setItem(CLUB_DISPLAY_DATA_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The Club page can resolve its own identity if storage is unavailable.
    }
  }

  function competitionList(competitions, stateValue = "ready") {
    const list = document.createElement("div");
    list.className = "myClubCompetitions";
    list.dataset.competitionState = stateValue;
    const current = Array.isArray(competitions) ? competitions : [];

    if (stateValue === "loading") return loadingCompetitionList();
    if (stateValue === "error") {
      const row = document.createElement("div");
      row.className = "myClubCompetition";
      const message = document.createElement("span");
      message.className = "myClubCompetitionName";
      message.textContent = "Competition data unavailable";
      row.appendChild(message);
      list.appendChild(row);
      return list;
    }

    current.forEach((competition) => {
      const row = document.createElement("div");
      row.className = "myClubCompetition";
      const name = document.createElement("span");
      name.className = "myClubCompetitionName";
      name.textContent = String(competition?.name || "").trim() || "Competition";
      const season = Number(competition?.seasonNumber);
      if (Number.isInteger(season) && season > 0) name.title = `Season ${season}`;

      const label = detailLabel(competition);
      row.appendChild(name);
      if (label) {
        const detail = document.createElement("span");
        detail.className = "myClubCompetitionStanding";
        detail.textContent = label;
        const medal = medalTier(competition, label);
        if (medal) detail.dataset.medal = medal;
        row.appendChild(detail);
      }
      list.appendChild(row);
    });
    return list;
  }

  function replaceCompetitionList(clubId, competitions, stateValue = "ready") {
    if (!(grid instanceof HTMLElement)) return;
    const card = Array.from(grid.querySelectorAll(".myClubCard[data-club-id]"))
      .find((candidate) => candidate instanceof HTMLElement && candidate.dataset.clubId === String(clubId));
    if (!(card instanceof HTMLElement)) return;
    const body = card.querySelector(".myClubCardBody");
    if (!(body instanceof HTMLElement)) return;
    body.querySelector(".myClubCompetitions")?.replaceWith(competitionList(competitions, stateValue));
  }

  function clubCard(club, competitionState = "loading") {
    const clubId = String(club?.clubId || "").trim();
    const name = String(club?.name || "").trim() || `Club ${clubId}`;
    const divisionInfo = typeof contractDivisionInfo === "function" ? contractDivisionInfo(Number(club?.division)) : null;
    const location = [String(club?.city || "").trim(), countryLabel(club?.nation)].filter(Boolean).join(", ");
    const primary = safeColor(club?.primaryColor);
    const secondary = safeColor(club?.secondaryColor);

    const link = document.createElement("a");
    link.className = "myClubCard";
    link.href = `/clubs/${encodeURIComponent(clubId)}/squad`;
    link.dataset.clubId = clubId;
    link.setAttribute("aria-label", `Open ${name}`);
    if (primary || secondary) {
      link.style.setProperty("--my-club-primary", primary || secondary);
      link.style.setProperty("--my-club-secondary", secondary || primary);
    }

    const logoFrame = document.createElement("div");
    logoFrame.className = "myClubLogoFrame";
    const logoUrl = String(club?.logoUrl || "").trim();
    if (logoUrl) {
      const logo = document.createElement("img");
      logo.className = "myClubLogo";
      logo.src = logoUrl;
      logo.alt = `${name} logo`;
      logo.decoding = "async";
      logo.loading = "lazy";
      logo.addEventListener("error", () => {
        logoFrame.hidden = true;
        link.classList.add("myClubCardNoLogo");
      }, { once: true });
      logoFrame.appendChild(logo);
    } else {
      logoFrame.hidden = true;
      link.classList.add("myClubCardNoLogo");
    }

    const body = document.createElement("div");
    body.className = "myClubCardBody";
    const title = document.createElement("div");
    title.className = "myClubTitleBlock";
    const id = document.createElement("span");
    id.className = "myClubId";
    id.textContent = clubId ? `#${clubId}` : "";
    const heading = document.createElement("h3");
    heading.className = "myClubName";
    heading.textContent = name;
    title.append(id, heading);

    const meta = document.createElement("div");
    meta.className = "myClubMeta";
    const division = document.createElement("span");
    division.className = "myClubDivision";
    division.textContent = divisionInfo?.name || "Division -";
    if (divisionInfo?.color) division.style.color = divisionInfo.color;
    meta.appendChild(division);
    if (location) {
      const locationNode = document.createElement("span");
      locationNode.className = "myClubLocation";
      locationNode.textContent = location;
      meta.appendChild(locationNode);
    }

    body.append(title, meta, competitionList(club?.competitions, competitionState));
    link.append(logoFrame, body);

    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const openClub = Reflect.get(window, "mflOpenClubPage");
      if (!clubId || typeof openClub !== "function") return;
      event.preventDefault();
      saveClubDestination(clubId, name, divisionInfo);
      void openClub(clubId, "attributes");
    });
    return link;
  }

  function sortedClubs(clubs) {
    return (Array.isArray(clubs) ? clubs : [])
      .filter((club) => String(club?.clubId || "").trim())
      .sort((left, right) => {
        const leftDivision = Number(left?.division);
        const rightDivision = Number(right?.division);
        const leftRank = leftDivision >= 1 && leftDivision <= 10 ? leftDivision : 999;
        const rightRank = rightDivision >= 1 && rightDivision <= 10 ? rightDivision : 999;
        return leftRank - rightRank
          || String(left?.name || "").localeCompare(String(right?.name || ""))
          || Number(left?.clubId || 0) - Number(right?.clubId || 0);
      });
  }

  function renderCards(clubs) {
    if (!(grid instanceof HTMLElement)) return;
    const valid = sortedClubs(clubs);
    const competitionState = competitionsReady ? "ready" : "loading";
    const fragment = document.createDocumentFragment();
    valid.forEach((club) => fragment.appendChild(clubCard(club, competitionState)));
    grid.replaceChildren(fragment);
    setBusy(false);
    setStatus(valid.length ? "" : "No clubs found for this wallet.");
    if (retryButton) retryButton.hidden = true;
  }

  async function privateResponse(path, timeoutMs) {
    const dataClient = Reflect.get(window, "__mflDataClient");
    if (!dataClient || typeof dataClient.fetch !== "function") throw new Error("Canonical data client is unavailable.");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await dataClient.fetch(path, {
        cache: "no-store",
        headers: { Accept: "application/json", ...walletProofHeaders(true) },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Loading My Clubs timed out. Retry.");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function requestClubs(wallet, force) {
    if (!force && inFlight && cachedWallet === wallet) return inFlight;

    cachedWallet = wallet;
    const sequence = ++requestSequence;
    let request;
    request = (async () => {
      try {
        const response = await privateResponse("/api/data?mode=my-clubs", CLUB_REQUEST_TIMEOUT_MS);
        const payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          if (sequence === requestSequence && activeWallet() === wallet) {
            clear();
            optOutWallet();
          }
          return [];
        }
        if (!response.ok) throw new Error(payload?.error || "Could not load clubs.");
        if (sequence !== requestSequence || activeWallet() !== wallet) return [];

        cachedClubs = Array.isArray(payload?.clubs) ? payload.clubs : [];
        cacheReady = true;
        competitionsReady = false;
        saveCount(wallet, cachedClubs.length);
        return cachedClubs;
      } finally {
        if (inFlight === request) inFlight = null;
      }
    })();

    inFlight = request;
    return request;
  }

  async function requestCompetitions(wallet, clubs) {
    const ids = sortedClubs(clubs).map((club) => String(club.clubId || "").trim()).filter(Boolean);
    if (!ids.length) {
      competitionsReady = true;
      return {};
    }
    if (competitionInFlight && cachedWallet === wallet) return competitionInFlight;

    const sequence = ++competitionSequence;
    let request;
    request = (async () => {
      try {
        const query = new URLSearchParams({
          mode: "my-clubs-competitions",
          clubIds: ids.join(","),
        });
        const response = await privateResponse(`/api/data?${query.toString()}`, COMPETITION_REQUEST_TIMEOUT_MS);
        const payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          if (sequence === competitionSequence && activeWallet() === wallet) {
            clear();
            optOutWallet();
          }
          return {};
        }
        if (!response.ok) throw new Error(payload?.error || "Could not load current competitions.");
        if (sequence !== competitionSequence || activeWallet() !== wallet) return {};

        const byClub = payload?.competitionsByClub && typeof payload.competitionsByClub === "object"
          ? payload.competitionsByClub
          : {};
        cachedClubs = cachedClubs.map((club) => ({
          ...club,
          competitions: Array.isArray(byClub?.[String(club.clubId)]) ? byClub[String(club.clubId)] : [],
        }));
        competitionsReady = true;
        return byClub;
      } finally {
        if (competitionInFlight === request) competitionInFlight = null;
      }
    })();

    competitionInFlight = request;
    return request;
  }

  function enrichCompetitions(wallet, clubs) {
    if (!clubs.length) return;
    void requestCompetitions(wallet, clubs)
      .then((byClub) => {
        if (activeWallet() !== wallet || !pageActive()) return;
        clubs.forEach((club) => {
          const clubId = String(club.clubId || "").trim();
          replaceCompetitionList(clubId, byClub?.[clubId] || [], "ready");
        });
      })
      .catch(() => {
        if (activeWallet() !== wallet || !pageActive()) return;
        clubs.forEach((club) => replaceCompetitionList(club.clubId, [], "error"));
      });
  }

  async function render({ force = false } = {}) {
    const wallet = activeWallet();
    if (!wallet || !hasWalletOptIn()) {
      clear();
      return [];
    }

    if (cachedWallet && cachedWallet !== wallet) clear();
    if (!force && cacheReady && cachedWallet === wallet) {
      renderCards(cachedClubs);
      if (!competitionsReady) enrichCompetitions(wallet, cachedClubs);
      return cachedClubs;
    }

    renderSkeletons(wallet);
    try {
      const clubs = await requestClubs(wallet, force);
      if (activeWallet() !== wallet || !pageActive()) return clubs;
      renderCards(clubs);
      enrichCompetitions(wallet, clubs);
      return clubs;
    } catch (error) {
      if (activeWallet() !== wallet || !pageActive()) return [];
      cachedClubs = [];
      cacheReady = false;
      competitionsReady = false;
      if (grid) grid.replaceChildren();
      setBusy(false);
      setStatus(error?.message || "Could not load clubs.", true);
      if (retryButton) retryButton.hidden = false;
      return [];
    }
  }

  retryButton?.addEventListener("click", () => {
    if (pageActive() && hasWalletOptIn()) void render({ force: true });
  });

  Reflect.set(window, "__mflRenderMyClubsPageOwner", render);
  Reflect.set(window, "__mflMyClubsRoute", Object.freeze({
    clear,
    refresh() {
      return pageActive() && hasWalletOptIn() ? render({ force: true }) : Promise.resolve([]);
    },
  }));
})();
