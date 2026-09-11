(() => {
  "use strict";

  if (Reflect.get(window, "__mflMyClubsRoute")) return;

  const PAGE = "my-clubs";
  const PATH = "/my-clubs";
  const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";
  const CACHE_MAX_AGE_MS = 60_000;
  const CLUB_REQUEST_TIMEOUT_MS = 10_000;
  const COMPETITION_REQUEST_TIMEOUT_MS = 15_000;
  const MIN_COMPETITION_ROWS = 2;
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
  let cacheUpdatedAt = 0;

  function activeWallet() {
    return normalizeWalletAddress(state.linkedWalletAddress || "").toLowerCase();
  }

  function pageActive() {
    return state.currentPage === PAGE
      && document.body?.dataset.page === PAGE
      && page instanceof HTMLElement
      && page.hidden === false;
  }

  function routeIsCurrent(options = {}) {
    return typeof pageNavigationIsCurrent !== "function" || pageNavigationIsCurrent(options);
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

  function renderBasePending() {
    if (grid instanceof HTMLElement) grid.replaceChildren();
    setBusy(true);
    setStatus("");
    if (retryButton) retryButton.hidden = true;
  }


  function appendLoadingText(element, sample) {
    const createTextSkeleton = Reflect.get(window, "__mflCreateTextSkeleton");
    if (!(element instanceof HTMLElement)) return element;
    if (typeof createTextSkeleton === "function") {
      element.appendChild(createTextSkeleton(String(sample || "00")));
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "mflDataPlaceholder";
      placeholder.setAttribute("aria-hidden", "true");
      element.appendChild(placeholder);
    }
    return element;
  }

  function loadingCompetitionList() {
    const competitions = document.createElement("div");
    competitions.className = "myClubCompetitions myClubCompetitionsLoading";
    competitions.dataset.competitionState = "loading";
    for (let index = 0; index < MIN_COMPETITION_ROWS; index += 1) {
      const row = document.createElement("div");
      row.className = "myClubCompetition myClubCompetitionLoading";
      const competition = document.createElement("span");
      competition.className = "myClubCompetitionName";
      appendLoadingText(competition, "Competition");
      const position = document.createElement("span");
      position.className = "myClubCompetitionStanding";
      appendLoadingText(position, index === 0 ? "00th" : "Runner-up");
      row.append(competition, position);
      competitions.appendChild(row);
    }
    return competitions;
  }

  function skeletonCard(club) {
    const clubId = String(club?.clubId || "").trim();
    const name = String(club?.name || "").trim() || `Club ${clubId || "0000"}`;
    const divisionInfo = typeof contractDivisionInfo === "function" ? contractDivisionInfo(Number(club?.division)) : null;
    const divisionLabel = divisionInfo?.name || "Division -";
    const location = [String(club?.city || "").trim(), countryLabel(club?.nation)].filter(Boolean).join(", ");
    const card = document.createElement("a");
    card.className = "myClubCard myClubCardLoading";
    card.href = clubId ? `/clubs/${encodeURIComponent(clubId)}/squad` : "#";
    card.dataset.clubId = clubId;
    card.setAttribute("aria-hidden", "true");

    const logoFrame = document.createElement("div");
    logoFrame.className = "myClubLogoFrame myClubLogoFrameLoading";
    if (!String(club?.logoUrl || "").trim()) {
      logoFrame.hidden = true;
      card.classList.add("myClubCardNoLogo");
    }

    const body = document.createElement("div");
    body.className = "myClubCardBody";
    const titleBlock = document.createElement("div");
    titleBlock.className = "myClubTitleBlock";
    const idLine = document.createElement("span");
    idLine.className = "myClubId";
    appendLoadingText(idLine, clubId ? `#${clubId}` : "#0000");
    const nameLine = document.createElement("h3");
    nameLine.className = "myClubName";
    appendLoadingText(nameLine, name);
    titleBlock.append(idLine, nameLine);

    const meta = document.createElement("div");
    meta.className = "myClubMeta";
    const divisionLine = document.createElement("span");
    divisionLine.className = "myClubDivision";
    appendLoadingText(divisionLine, divisionLabel);
    meta.appendChild(divisionLine);
    if (location) {
      const locationLine = document.createElement("span");
      locationLine.className = "myClubLocation";
      appendLoadingText(locationLine, location);
      meta.appendChild(locationLine);
    }

    body.append(titleBlock, meta, loadingCompetitionList());
    card.append(logoFrame, body);
    return card;
  }

  function renderClubSkeletons(clubs) {
    if (!(grid instanceof HTMLElement)) return;
    const valid = sortedClubs(clubs);
    const fragment = document.createDocumentFragment();
    valid.forEach((club) => fragment.appendChild(skeletonCard(club)));
    grid.replaceChildren(fragment);
    setBusy(Boolean(valid.length));
    setStatus(valid.length ? "" : "No clubs found for this wallet.");
    if (retryButton) retryButton.hidden = true;
  }


  function clear() {
    Reflect.get(window, "__mflMyClubsOwnershipPrefetch")?.clear?.();
    requestSequence += 1;
    competitionSequence += 1;
    cachedWallet = "";
    cachedClubs = [];
    cacheReady = false;
    competitionsReady = false;
    inFlight = null;
    competitionInFlight = null;
    cacheUpdatedAt = 0;
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
    if (stateValue === "loading") return loadingCompetitionList();
    if (stateValue === "error") return null;

    const list = document.createElement("div");
    list.className = "myClubCompetitions";
    list.dataset.competitionState = stateValue;
    const current = Array.isArray(competitions) ? competitions : [];

    {
      current.forEach((competition) => {
        const row = document.createElement("div");
        row.className = "myClubCompetition";
        const name = document.createElement("span");
        name.className = "myClubCompetitionName";
        name.textContent = String(competition?.name || "").trim() || "Competition";
        const label = detailLabel(competition);
        row.appendChild(name);
        const detail = document.createElement("span");
        detail.className = "myClubCompetitionStanding";
        detail.textContent = label || "00th";
        if (!label) detail.classList.add("myClubCompetitionReserved");
        const medal = medalTier(competition, label);
        if (medal) detail.dataset.medal = medal;
        row.appendChild(detail);
        list.appendChild(row);
      });
    }

    while (list.children.length < MIN_COMPETITION_ROWS) {
      const row = document.createElement("div");
      row.className = "myClubCompetition myClubCompetitionReserved";
      const name = document.createElement("span");
      name.className = "myClubCompetitionName";
      name.textContent = "Competition";
      const detail = document.createElement("span");
      detail.className = "myClubCompetitionStanding";
      detail.textContent = "00th";
      row.append(name, detail);
      list.appendChild(row);
    }
    return list;
  }

  function replaceClubCard(club, competitions, stateValue = "ready") {
    if (!(grid instanceof HTMLElement)) return;
    const clubId = String(club?.clubId || "").trim();
    const current = Array.from(grid.querySelectorAll(".myClubCard[data-club-id]"))
      .find((candidate) => candidate instanceof HTMLElement && candidate.dataset.clubId === clubId);
    if (!(current instanceof HTMLElement)) return;
    current.replaceWith(clubCard({ ...club, competitions }, stateValue));
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

    const competitions = competitionList(club?.competitions, competitionState);
    if (competitionState === "error") link.classList.add("myClubCardCompetitionUnavailable");
    body.append(title, meta);
    if (competitions instanceof HTMLElement) body.appendChild(competitions);
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

  function renderCards(clubs, requestedCompetitionState = "") {
    if (!(grid instanceof HTMLElement)) return;
    const valid = sortedClubs(clubs);
    const competitionState = requestedCompetitionState || (competitionsReady ? "ready" : "loading");
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

  async function publicResponse(path, timeoutMs) {
    const dataClient = Reflect.get(window, "__mflDataClient");
    if (!dataClient || typeof dataClient.fetch !== "function") throw new Error("Canonical data client is unavailable.");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await dataClient.fetch(path, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Loading My Clubs competitions timed out.");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function requestClubs(wallet, force) {
    if (!force && inFlight && cachedWallet === wallet) return inFlight;

    competitionSequence += 1;
    competitionInFlight = null;
    cacheReady = false;
    competitionsReady = false;
    cacheUpdatedAt = 0;
    cachedWallet = wallet;
    const sequence = ++requestSequence;
    let request;
    request = (async () => {
      try {
        const prefetch = Reflect.get(window, "__mflMyClubsOwnershipPrefetch");
        if (force) prefetch?.clear?.();
        const pendingOwnership = !force ? prefetch?.take?.(walletProofHeaders(true)) : null;
        const response = await (pendingOwnership || privateResponse("/api/data?mode=my-clubs", CLUB_REQUEST_TIMEOUT_MS));
        const payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          if (sequence === requestSequence && activeWallet() === wallet) {
            clear();
            optOutWallet({ toastMessage: "Dapper opt-in expired. Opt in again to load My Clubs." });
          }
          return [];
        }
        if (!response.ok) {
          throw new Error(payload?.error || `My Clubs request failed (HTTP ${response.status}).`);
        }
        if (sequence !== requestSequence || activeWallet() !== wallet) return [];

        cachedClubs = Array.isArray(payload?.clubs) ? payload.clubs : [];
        cacheReady = true;
        cacheUpdatedAt = Date.now();
        competitionsReady = false;
        return cachedClubs;
      } finally {
        if (inFlight === request) inFlight = null;
      }
    })();

    inFlight = request;
    return request;
  }

  async function requestCompetitions(wallet, clubs, sequence) {
    const ids = sortedClubs(clubs)
      .map((club) => String(club?.clubId || "").trim())
      .filter(Boolean);
    if (!ids.length) return {};

    const query = new URLSearchParams({
      mode: "my-clubs-competitions",
      clubIds: ids.join(","),
    });
    const response = await publicResponse(`/api/data?${query.toString()}`, COMPETITION_REQUEST_TIMEOUT_MS);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || `My Clubs competition request failed (HTTP ${response.status}).`);
    }
    if (sequence !== competitionSequence || activeWallet() !== wallet) return null;
    return payload?.competitionsByClub && typeof payload.competitionsByClub === "object"
      ? payload.competitionsByClub
      : {};
  }

  function enrichCompetitions(wallet, clubs) {
    if (competitionInFlight) return competitionInFlight;
    const request = loadCompetitions(wallet, clubs).finally(() => {
      if (competitionInFlight === request) competitionInFlight = null;
    });
    competitionInFlight = request;
    return request;
  }

  async function loadCompetitions(wallet, clubs) {
    const valid = sortedClubs(clubs);
    if (!valid.length) {
      competitionsReady = true;
      cacheUpdatedAt = Date.now();
      setBusy(false);
      return;
    }

    const sequence = ++competitionSequence;
    try {
      const byClub = await requestCompetitions(wallet, valid, sequence);
      if (byClub === null || sequence !== competitionSequence || activeWallet() !== wallet) return;
      cachedClubs = cachedClubs.map((club) => ({
        ...club,
        competitions: Array.isArray(byClub?.[String(club.clubId)]) ? byClub[String(club.clubId)] : [],
      }));
      competitionsReady = true;
      cacheUpdatedAt = Date.now();
      if (pageActive()) renderCards(cachedClubs, "ready");
    } catch {
      if (sequence !== competitionSequence || activeWallet() !== wallet) return;
      competitionsReady = false;
      if (pageActive()) renderCards(valid, "error");
    }
  }

  async function render({ force = false } = {}) {
    const wallet = activeWallet();
    if (!wallet || !hasWalletOptIn()) {
      clear();
      return [];
    }

    if (cachedWallet && cachedWallet !== wallet) clear();
    const cacheFresh = cacheUpdatedAt > 0 && Date.now() - cacheUpdatedAt < CACHE_MAX_AGE_MS;
    if (!force && cacheReady && cachedWallet === wallet && (cacheFresh || competitionInFlight)) {
      if (competitionsReady) renderCards(cachedClubs);
      else {
        renderClubSkeletons(cachedClubs);
        void enrichCompetitions(wallet, cachedClubs);
      }
      return cachedClubs;
    }

    renderBasePending();
    try {
      const clubs = await requestClubs(wallet, force);
      if (activeWallet() !== wallet || !pageActive()) return clubs;
      if (!clubs.length) {
        competitionsReady = true;
        cacheUpdatedAt = Date.now();
        renderCards([]);
        setBusy(false);
        return clubs;
      }
      renderClubSkeletons(clubs);
      void enrichCompetitions(wallet, clubs);
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

  function showOnly(target) {
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (candidate instanceof HTMLElement) candidate.hidden = candidate !== target;
    });
  }

  function syncNavigation() {
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      button.classList.toggle("active", String(button.dataset.page || "") === PAGE);
    });
  }

  function setCanonicalUrl(updateHash, options = {}) {
    if (options.replaceUrl && window.location.pathname !== PATH) {
      window.history.replaceState({}, "", PATH);
      return;
    }
    if (updateHash && window.location.pathname !== PATH) {
      window.history.pushState({}, "", PATH);
    }
  }

  async function renderRoute(updateHash = true, options = {}) {
    if (!routeIsCurrent(options)) return null;

    const locked = !hasWalletOptIn();
    state.currentPage = PAGE;
    document.body.dataset.page = PAGE;
    syncNavigation();

    if (locked) {
      clear();
      const lockedPage = document.getElementById("myPlayersLockedPage");
      const lockedTitle = document.getElementById("optInLockedTitle");
      const lockedMessage = document.getElementById("optInLockedMessage");
      if (lockedTitle) lockedTitle.textContent = "My Clubs";
      if (lockedMessage) lockedMessage.textContent = "In order to see your clubs, you need to opt in.";
      if (lockedPage instanceof HTMLElement) showOnly(lockedPage);
      syncHomeLoginButton?.();
      return null;
    }

    setCanonicalUrl(updateHash, options);
    if (page instanceof HTMLElement) showOnly(page);
    if (!routeIsCurrent(options)) return null;

    await render();
    if (!routeIsCurrent(options)) return null;
    return true;
  }

  Reflect.set(window, "__mflRenderMyClubsPageOwner", renderRoute);

  retryButton?.addEventListener("click", () => {
    void render({ force: true });
  });

  Reflect.set(window, "__mflMyClubsRoute", Object.freeze({
    refresh() {
      clear();
      return state.currentPage === PAGE && hasWalletOptIn()
        ? render({ force: true })
        : Promise.resolve([]);
    },
    clear,
  }));
})();
