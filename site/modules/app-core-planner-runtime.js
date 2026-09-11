// Generated Planner core from modules/core-sources/planner.js. Do not edit directly.
(() => {
  "use strict";

  const PAGE = "planner";
  const BASE_PATH = "/planner";
  const DEFAULT_FORMATION = "4-3-3";
  const formations = Object.freeze({
    "4-3-3": Object.freeze([
      ["gk", "GK", 50, 91],
      ["lb", "LB", 14, 73],
      ["cb1", "CB", 38, 78],
      ["cb2", "CB", 62, 78],
      ["rb", "RB", 86, 73],
      ["cm1", "CM", 27, 52],
      ["cm2", "CM", 50, 57],
      ["cm3", "CM", 73, 52],
      ["lw", "LW", 18, 25],
      ["st", "ST", 50, 17],
      ["rw", "RW", 82, 25],
    ]),
    "4-2-3-1": Object.freeze([
      ["gk", "GK", 50, 91],
      ["lb", "LB", 14, 73],
      ["cb1", "CB", 38, 78],
      ["cb2", "CB", 62, 78],
      ["rb", "RB", 86, 73],
      ["dm1", "CDM", 36, 58],
      ["dm2", "CDM", 64, 58],
      ["lam", "LAM", 22, 37],
      ["cam", "CAM", 50, 34],
      ["ram", "RAM", 78, 37],
      ["st", "ST", 50, 16],
    ]),
    "4-4-2": Object.freeze([
      ["gk", "GK", 50, 91],
      ["lb", "LB", 14, 73],
      ["cb1", "CB", 38, 78],
      ["cb2", "CB", 62, 78],
      ["rb", "RB", 86, 73],
      ["lm", "LM", 16, 49],
      ["cm1", "CM", 39, 54],
      ["cm2", "CM", 61, 54],
      ["rm", "RM", 84, 49],
      ["st1", "ST", 38, 20],
      ["st2", "ST", 62, 20],
    ]),
    "3-5-2": Object.freeze([
      ["gk", "GK", 50, 91],
      ["cb1", "CB", 25, 75],
      ["cb2", "CB", 50, 80],
      ["cb3", "CB", 75, 75],
      ["lwb", "LWB", 12, 50],
      ["cm1", "CM", 34, 55],
      ["cam", "CAM", 50, 40],
      ["cm2", "CM", 66, 55],
      ["rwb", "RWB", 88, 50],
      ["st1", "ST", 38, 19],
      ["st2", "ST", 62, 19],
    ]),
    "3-4-3": Object.freeze([
      ["gk", "GK", 50, 91],
      ["cb1", "CB", 25, 75],
      ["cb2", "CB", 50, 80],
      ["cb3", "CB", 75, 75],
      ["lm", "LM", 15, 51],
      ["cm1", "CM", 40, 55],
      ["cm2", "CM", 60, 55],
      ["rm", "RM", 85, 51],
      ["lw", "LW", 20, 23],
      ["st", "ST", 50, 16],
      ["rw", "RW", 80, 23],
    ]),
  });

  const page = document.getElementById("plannerPage");
  const workspace = document.getElementById("plannerWorkspace");
  const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("plannerClubSearchInput"));
  const searchResults = document.getElementById("plannerClubSearchResults");
  const formationSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById("plannerFormationSelect"));
  const pitch = document.getElementById("plannerPitch");
  const roster = document.getElementById("plannerRoster");
  const rosterCount = document.getElementById("plannerRosterCount");
  const status = document.getElementById("plannerStatus");
  const clubName = document.getElementById("plannerClubName");
  const clubLogo = document.getElementById("plannerClubLogo");
  const newPlanButton = document.getElementById("plannerNewPlanButton");

  const plannerState = {
    clubId: "",
    club: null,
    columns: [],
    rows: [],
    formationId: DEFAULT_FORMATION,
    assignments: new Map(),
    selectedPlayerId: "",
    requestSequence: 0,
  };

  let searchTimer = 0;
  let searchSequence = 0;

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

  function setStatus(message = "") {
    if (status instanceof HTMLElement) status.textContent = message;
  }

  function columnIndex(name) {
    return plannerState.columns.indexOf(name);
  }

  function value(row, name) {
    const index = columnIndex(name);
    if (index < 0 || !Array.isArray(row)) return "";
    return row[index];
  }

  function playerId(row) {
    return String(value(row, "player_id") || value(row, "id") || "").trim();
  }

  function playerName(row) {
    return String(value(row, "name") || ("Player " + playerId(row))).trim();
  }

  function playerPositions(row) {
    const raw = value(row, "positions");
    if (Array.isArray(raw)) return raw.map((position) => String(position || "").trim()).filter(Boolean);
    const text = String(raw || "").trim();
    if (!text) return [];
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.map((position) => String(position || "").trim()).filter(Boolean);
      } catch {
        // Fall through to the comma-separated representation.
      }
    }
    return text.split(",").map((position) => position.trim()).filter(Boolean);
  }

  function playerOverall(row) {
    const overall = Number(value(row, "overall"));
    return Number.isFinite(overall) ? Math.round(overall) : null;
  }

  function rowByPlayerId(id) {
    return plannerState.rows.find((row) => playerId(row) === String(id || "")) || null;
  }

  function assignedPlayerIds() {
    return new Set(Array.from(plannerState.assignments.values()).filter(Boolean));
  }

  function setCanonicalUrl(clubId = plannerState.clubId, { replace = true } = {}) {
    const normalizedClubId = String(clubId || "").trim();
    const next = normalizedClubId ? BASE_PATH + "?club=" + encodeURIComponent(normalizedClubId) : BASE_PATH;
    if (window.location.pathname + window.location.search === next) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", next);
  }

  function renderClubIdentity() {
    const identity = plannerState.club && typeof plannerState.club === "object" ? plannerState.club : {};
    const name = String(identity.name || identity.clubName || (plannerState.clubId ? "Club " + plannerState.clubId : "Select a Club")).trim();
    if (clubName instanceof HTMLElement) clubName.textContent = name;
    if (searchInput instanceof HTMLInputElement && plannerState.clubId) searchInput.value = name;

    if (clubLogo instanceof HTMLImageElement) {
      const logoUrl = String(identity.logoUrl || "").trim();
      if (logoUrl) {
        clubLogo.src = logoUrl;
        clubLogo.alt = name + " logo";
        clubLogo.hidden = false;
        clubLogo.onerror = () => {
          clubLogo.removeAttribute("src");
          clubLogo.alt = "";
          clubLogo.hidden = true;
        };
      } else {
        clubLogo.removeAttribute("src");
        clubLogo.alt = "";
        clubLogo.hidden = true;
      }
    }
  }

  function renderFormationOptions() {
    if (!(formationSelect instanceof HTMLSelectElement)) return;
    if (!formationSelect.options.length) {
      Object.keys(formations).forEach((formationId) => {
        const option = document.createElement("option");
        option.value = formationId;
        option.textContent = formationId;
        formationSelect.appendChild(option);
      });
    }
    formationSelect.value = plannerState.formationId;
  }

  function renderPitch() {
    if (!(pitch instanceof HTMLElement)) return;
    const slots = formations[plannerState.formationId] || formations[DEFAULT_FORMATION];
    const fragment = document.createDocumentFragment();

    slots.forEach(([slotId, label, x, y]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "plannerSlot";
      button.dataset.slotId = slotId;
      button.style.setProperty("--planner-x", x + "%");
      button.style.setProperty("--planner-y", y + "%");

      const labelNode = document.createElement("span");
      labelNode.className = "plannerSlotLabel";
      labelNode.textContent = label;

      const assignedId = String(plannerState.assignments.get(slotId) || "");
      const row = assignedId ? rowByPlayerId(assignedId) : null;
      const playerNode = document.createElement("span");
      playerNode.className = "plannerSlotPlayer";
      const overallNode = document.createElement("span");
      overallNode.className = "plannerSlotOverall";

      if (row) {
        playerNode.textContent = playerName(row);
        const overall = playerOverall(row);
        overallNode.textContent = overall === null ? playerPositions(row).join(" / ") : "OVR " + overall;
        button.setAttribute("aria-label", label + ": " + playerName(row) + ". Select to move this player.");
      } else {
        button.classList.add("is-empty");
        playerNode.textContent = "Select";
        overallNode.textContent = "Position";
        button.setAttribute("aria-label", "Empty " + label + " position");
      }

      button.append(labelNode, playerNode, overallNode);
      button.addEventListener("click", () => {
        if (plannerState.selectedPlayerId) {
          for (const [assignedSlotId, assignedPlayerId] of plannerState.assignments.entries()) {
            if (assignedPlayerId === plannerState.selectedPlayerId) plannerState.assignments.delete(assignedSlotId);
          }
          plannerState.assignments.set(slotId, plannerState.selectedPlayerId);
          plannerState.selectedPlayerId = "";
          setStatus("Player assigned. Select another player to continue.");
          renderWorkspace();
          return;
        }

        if (assignedId) {
          plannerState.assignments.delete(slotId);
          plannerState.selectedPlayerId = assignedId;
          setStatus("Player selected. Choose another position or select the player again to cancel.");
          renderWorkspace();
        }
      });

      fragment.appendChild(button);
    });

    pitch.replaceChildren(fragment);
  }

  function renderRoster() {
    if (!(roster instanceof HTMLElement)) return;
    const assigned = assignedPlayerIds();
    const available = plannerState.rows
      .filter((row) => {
        const id = playerId(row);
        return id && !assigned.has(id);
      })
      .sort((left, right) => {
        const leftOverall = playerOverall(left) ?? -1;
        const rightOverall = playerOverall(right) ?? -1;
        return rightOverall - leftOverall || playerName(left).localeCompare(playerName(right));
      });

    const fragment = document.createDocumentFragment();
    available.forEach((row) => {
      const id = playerId(row);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "plannerPlayer";
      if (id === plannerState.selectedPlayerId) button.classList.add("is-selected");
      button.dataset.playerId = id;

      const identity = document.createElement("span");
      const name = document.createElement("span");
      name.className = "plannerPlayerName";
      name.textContent = playerName(row);
      const meta = document.createElement("span");
      meta.className = "plannerPlayerMeta";
      meta.textContent = playerPositions(row).join(" / ") || "—";
      identity.append(name, meta);

      const overall = document.createElement("span");
      overall.className = "plannerPlayerOverall";
      const value = playerOverall(row);
      overall.textContent = value === null ? "—" : String(value);

      button.append(identity, overall);
      button.addEventListener("click", () => {
        plannerState.selectedPlayerId = plannerState.selectedPlayerId === id ? "" : id;
        setStatus(plannerState.selectedPlayerId ? "Player selected. Choose a position on the pitch." : "Player selection cleared.");
        renderRoster();
      });
      fragment.appendChild(button);
    });

    roster.replaceChildren(fragment);
    if (rosterCount instanceof HTMLElement) rosterCount.textContent = String(available.length);
  }

  function renderWorkspace() {
    renderClubIdentity();
    renderFormationOptions();
    renderPitch();
    renderRoster();
    if (workspace instanceof HTMLElement) workspace.hidden = !plannerState.clubId;
  }

  function clearPlan({ clearClub = false } = {}) {
    plannerState.assignments.clear();
    plannerState.selectedPlayerId = "";
    plannerState.formationId = DEFAULT_FORMATION;
    if (clearClub) {
      plannerState.clubId = "";
      plannerState.club = null;
      plannerState.columns = [];
      plannerState.rows = [];
      if (searchInput instanceof HTMLInputElement) searchInput.value = "";
      setCanonicalUrl("");
    }
    renderWorkspace();
    setStatus(plannerState.clubId ? "Plan cleared." : "Choose a Club to start planning.");
  }

  async function loadClub(clubId, { updateUrl = true } = {}) {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) {
      clearPlan({ clearClub: true });
      return false;
    }

    const sequence = ++plannerState.requestSequence;
    setStatus("Loading Club…");
    if (workspace instanceof HTMLElement) workspace.hidden = true;
    try {
      const query = new URLSearchParams({
        mode: "page",
        scope: "club",
        view: "attributes",
        page: "1",
        pageSize: "5000",
        sortKey: "positions",
        sortDirection: "asc",
        access: "public-database",
        clubId: normalizedClubId,
      });
      const response = await window.__mflDataClient.fetch("/api/data?" + query.toString(), {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not load this Club.");
      if (sequence !== plannerState.requestSequence || state.currentPage !== PAGE) return false;

      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const columns = Array.isArray(payload?.columns) ? payload.columns : [];
      if (!rows.length && !payload?.club) throw new Error("Club not found.");

      plannerState.clubId = normalizedClubId;
      plannerState.club = payload?.club && typeof payload.club === "object"
        ? { ...payload.club, clubId: normalizedClubId }
        : { clubId: normalizedClubId };
      plannerState.columns = columns;
      plannerState.rows = rows;
      plannerState.assignments.clear();
      plannerState.selectedPlayerId = "";
      plannerState.formationId = DEFAULT_FORMATION;
      if (updateUrl) setCanonicalUrl(normalizedClubId);
      renderWorkspace();
      setStatus(rows.length + " players loaded. Select a player, then a position.");
      Reflect.get(window, "__mflDocumentTitleRuntime")?.sync?.();
      return true;
    } catch (error) {
      if (sequence !== plannerState.requestSequence || state.currentPage !== PAGE) return false;
      plannerState.clubId = "";
      plannerState.club = null;
      plannerState.columns = [];
      plannerState.rows = [];
      plannerState.assignments.clear();
      renderWorkspace();
      setStatus(error?.message || "Could not load this Club.");
      return false;
    }
  }

  function renderSearchResults(entries) {
    if (!(searchResults instanceof HTMLElement)) return;
    const clubs = Array.isArray(entries) ? entries : [];
    if (!clubs.length) {
      searchResults.hidden = true;
      searchResults.replaceChildren();
      return;
    }

    const fragment = document.createDocumentFragment();
    clubs.forEach((club) => {
      const id = String(club?.clubId || club?.id || "").trim();
      const name = String(club?.name || club?.clubName || (id ? "Club " + id : "")).trim();
      if (!id || !name) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "plannerClubSearchResult";
      button.setAttribute("role", "option");
      const nameNode = document.createElement("span");
      nameNode.className = "plannerClubSearchResultName";
      nameNode.textContent = name;
      const metaNode = document.createElement("span");
      metaNode.className = "plannerClubSearchResultMeta";
      metaNode.textContent = String(club?.divisionName || club?.division || ("#" + id));
      button.append(nameNode, metaNode);
      button.addEventListener("click", () => {
        searchResults.hidden = true;
        searchResults.replaceChildren();
        if (searchInput instanceof HTMLInputElement) searchInput.value = name;
        void loadClub(id);
      });
      fragment.appendChild(button);
    });
    searchResults.replaceChildren(fragment);
    searchResults.hidden = !searchResults.childElementCount;
  }

  async function searchClubs(query) {
    const normalized = String(query || "").trim();
    if (normalized.length < 2) {
      renderSearchResults([]);
      return;
    }
    const sequence = ++searchSequence;
    try {
      const parameters = new URLSearchParams({ mode: "search", type: "clubs", limit: "20", q: normalized });
      const response = await window.__mflDataClient.fetch("/api/data?" + parameters.toString(), {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || sequence !== searchSequence) return;
      renderSearchResults(payload?.results);
    } catch {
      if (sequence === searchSequence) renderSearchResults([]);
    }
  }

  function queryClubId() {
    return String(new URLSearchParams(window.location.search).get("club") || "").trim();
  }

  async function renderRoute(updateHash = true, options = {}) {
    state.currentPage = PAGE;
    document.body.dataset.page = PAGE;
    syncNavigation();
    if (page instanceof HTMLElement) showOnly(page);

    const requestedClubId = String(options.clubId || queryClubId() || "").trim();
    if (updateHash && !requestedClubId && window.location.pathname !== BASE_PATH) {
      window.history.pushState({}, "", BASE_PATH);
    }

    if (requestedClubId && requestedClubId !== plannerState.clubId) {
      await loadClub(requestedClubId, { updateUrl: updateHash });
    } else {
      renderWorkspace();
      setStatus(plannerState.clubId ? "Select a player, then a position." : "Choose a Club to start planning.");
    }
    syncHomeLoginButton?.();
    return true;
  }

  formationSelect?.addEventListener("change", () => {
    const next = String(formationSelect.value || "");
    if (!formations[next] || next === plannerState.formationId) return;
    plannerState.formationId = next;
    plannerState.assignments.clear();
    plannerState.selectedPlayerId = "";
    renderWorkspace();
    setStatus("Formation changed. Player assignments were reset.");
  });

  searchInput?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      void searchClubs(searchInput.value);
    }, 180);
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchResults.hidden = true;
      searchResults.replaceChildren();
      searchInput.blur();
    }
  });

  document.addEventListener("click", (event) => {
    if (!(searchResults instanceof HTMLElement) || searchResults.hidden) return;
    const target = event.target;
    if (target === searchInput || (target instanceof Node && searchResults.contains(target))) return;
    searchResults.hidden = true;
  });

  newPlanButton?.addEventListener("click", () => clearPlan());

  Reflect.set(window, "__mflRenderPlannerPageOwner", renderRoute);
  Reflect.set(window, "__mflPlannerRoute", Object.freeze({
    loadClub,
    reset: clearPlan,
    formations,
  }));
})();
