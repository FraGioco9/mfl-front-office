// Generated Planner core from modules/core-sources/planner.js. Do not edit directly.
(() => {
  "use strict";

  const PAGE = "planner";
  const BASE_PATH = "/planner";
  const DEFAULT_FORMATION = "4-3-3";
  const PLANS_API = "/api/planner-plans";
  const FORMATIONS_URL = "/planner-formations.json";
  let formations = Object.freeze({});
  let formationLoadPromise = null;

  function normalizeFormationData(payload) {
    const items = Array.isArray(payload) ? payload : [];
    const entries = items.map((formation) => {
      const id = String(formation?.id || "").trim();
      const name = String(formation?.name || id).trim() || id;
      const slots = Array.isArray(formation?.slots)
        ? formation.slots.map((slot) => Object.freeze({
            id: String(slot?.id || "").trim(),
            position: String(slot?.position || "").trim(),
            x: Number(slot?.x),
            y: Number(slot?.y),
          }))
        : [];
      if (!id || slots.length !== 11 || slots.some((slot) => (
        !slot.id
        || !slot.position
        || !Number.isFinite(slot.x)
        || !Number.isFinite(slot.y)
      ))) {
        throw new Error("Planner formation data is invalid.");
      }
      return [id, Object.freeze({ id, name, slots: Object.freeze(slots) })];
    });
    const next = Object.freeze(Object.fromEntries(entries));
    if (!next[DEFAULT_FORMATION]) throw new Error("Planner default formation is unavailable.");
    return next;
  }

  async function ensureFormations() {
    if (formations[DEFAULT_FORMATION]) return formations;
    if (formationLoadPromise) return formationLoadPromise;
    formationLoadPromise = (async () => {
      const response = await window.__mflDataClient.fetch(FORMATIONS_URL, {
        cache: "force-cache",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error("Could not load Planner formations.");
      formations = normalizeFormationData(payload);
      return formations;
    })().catch((error) => {
      formationLoadPromise = null;
      throw error;
    });
    return formationLoadPromise;
  }

  const page = document.getElementById("plannerPage");
  const workspace = document.getElementById("plannerWorkspace");
  const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("plannerClubSearchInput"));
  const searchResults = document.getElementById("plannerClubSearchResults");
  const searchClearButton = document.getElementById("plannerClubSearchClearButton");
  const playerSearchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("plannerPlayerSearchInput"));
  const playerSearchResults = document.getElementById("plannerPlayerSearchResults");
  const playerSearchClearButton = document.getElementById("plannerPlayerSearchClearButton");
  const planNameInput = /** @type {HTMLInputElement | null} */ (document.getElementById("plannerPlanNameInput"));
  const savedPlanSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById("plannerSavedPlanSelect"));
  const formationSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById("plannerFormationSelect"));
  const pitch = document.getElementById("plannerPitch");
  const roster = document.getElementById("plannerRoster");
  const rosterCount = document.getElementById("plannerRosterCount");
  const status = document.getElementById("plannerStatus");
  const clubName = document.getElementById("plannerClubName");
  const clubLogo = document.getElementById("plannerClubLogo");
  const sharedNotice = document.getElementById("plannerSharedNotice");
  const newPlanButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("plannerNewPlanButton"));
  const savePlanButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("plannerSavePlanButton"));
  const duplicatePlanButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("plannerDuplicatePlanButton"));
  const sharePlanButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("plannerSharePlanButton"));

  const plannerState = {
    clubId: "",
    club: null,
    columns: [],
    rows: [],
    formationId: DEFAULT_FORMATION,
    squadPlayers: new Map(),
    plannedSquadPlayerIds: null,
    requestSequence: 0,
    planId: "",
    planName: "My plan",
    canEdit: true,
    visibility: "private",
    revision: 0,
    dirty: false,
    savedPlans: [],
    loading: false,
  };

  const PITCH_LINE_CLASSES = Object.freeze([
    "pitchBoxTop", "pitchGoalTop", "pitchArcTop", "pitchBoxBottom", "pitchGoalBottom", "pitchArcBottom",
  ]);

  let searchTimer = 0;
  let searchSequence = 0;
  let playerSearchTimer = 0;
  let playerSearchSequence = 0;
  let planSequence = 0;

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

  function walletOptedIn() {
    return typeof hasWalletOptIn === "function" ? hasWalletOptIn() : true;
  }

  function editable() {
    return !plannerState.loading && (!plannerState.planId || plannerState.canEdit);
  }

  function columnValue(row, columns, name) {
    const index = Array.isArray(columns) ? columns.indexOf(name) : -1;
    if (index < 0 || !Array.isArray(row)) return "";
    return row[index];
  }

  function normalizePlayerPositions(raw) {
    if (Array.isArray(raw)) return raw.map((position) => String(position || "").trim().toUpperCase()).filter(Boolean);
    const text = String(raw || "").trim();
    if (!text) return [];
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.map((position) => String(position || "").trim().toUpperCase()).filter(Boolean);
      } catch {}
    }
    return text.split(",").map((position) => position.trim().toUpperCase()).filter(Boolean);
  }

  function plannerPlayerFromRow(row, columns = plannerState.columns) {
    const id = String(columnValue(row, columns, "player_id") || columnValue(row, columns, "id") || "").trim();
    if (!id) return null;
    const rawOverall = Number(columnValue(row, columns, "overall"));
    const retirementValue = columnValue(row, columns, "retirement_years");
    return {
      id,
      name: String(columnValue(row, columns, "name") || ("Player " + id)).trim(),
      positions: normalizePlayerPositions(columnValue(row, columns, "positions")),
      overall: Number.isFinite(rawOverall) ? Math.round(rawOverall) : null,
      retired: retirementValue !== "" && retirementValue !== null && Number(retirementValue) === 0,
    };
  }

  function plannerPlayerFromSearchEntry(entry) {
    const id = String(entry?.playerId || "").trim();
    if (!id) return null;
    const rawOverall = Number(entry?.overall);
    return {
      id,
      name: String(entry?.nameDisplay || ("Player " + id)).trim(),
      positions: normalizePlayerPositions(entry?.positionsDisplay),
      overall: Number.isFinite(rawOverall) ? Math.round(rawOverall) : null,
      retired: Boolean(entry?.retired),
    };
  }

  function squadPlayersSorted() {
    return Array.from(plannerState.squadPlayers.values()).sort((left, right) => {
      const leftOverall = left.overall ?? -1;
      const rightOverall = right.overall ?? -1;
      return rightOverall - leftOverall || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    });
  }

  function squadPlayerIds() {
    return squadPlayersSorted().map((player) => player.id);
  }

  function setSquadFromClubRows() {
    const next = new Map();
    plannerState.rows.forEach((row) => {
      const player = plannerPlayerFromRow(row);
      if (player?.id) next.set(player.id, player);
    });
    plannerState.squadPlayers = next;
    plannerState.plannedSquadPlayerIds = squadPlayerIds();
  }

  function depthChartForFormation() {
    const formation = formations[plannerState.formationId] || formations[DEFAULT_FORMATION];
    const result = new Map((formation?.slots || []).map((slot) => [slot.id, []]));
    const slotsByPosition = new Map();
    (formation?.slots || []).forEach((slot) => {
      const position = String(slot.position || "").toUpperCase();
      const slots = slotsByPosition.get(position) || [];
      slots.push(slot);
      slotsByPosition.set(position, slots);
    });
    const squad = squadPlayersSorted();
    for (const [position, slots] of slotsByPosition.entries()) {
      const candidates = squad.filter((player) => player.positions.includes(position));
      candidates.forEach((player, index) => {
        const target = slots[index % slots.length];
        result.get(target.id)?.push(player);
      });
    }
    return result;
  }

  function setCanonicalUrl({ planId = plannerState.planId, clubId = plannerState.clubId, replace = true } = {}) {
    const normalizedPlanId = String(planId || "").trim();
    const normalizedClubId = String(clubId || "").trim();
    const next = normalizedPlanId
      ? BASE_PATH + "/" + encodeURIComponent(normalizedPlanId)
      : normalizedClubId
        ? BASE_PATH + "?club=" + encodeURIComponent(normalizedClubId)
        : BASE_PATH;
    if (window.location.pathname + window.location.search === next) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", next);
    Reflect.get(window, "__mflDocumentTitleRuntime")?.sync?.();
  }

  function markDirty() {
    if (!editable()) return;
    plannerState.dirty = true;
    syncPlanControls();
  }

  function syncPlanDropdowns() {
    const dropdownRuntime = Reflect.get(window, "__mflDropdowns");
    const syncSelect = dropdownRuntime?.syncSelect;
    if (typeof syncSelect !== "function") return;
    syncSelect(savedPlanSelect);
    syncSelect(formationSelect);
  }

  function syncSearchClearButton() {
    if (!(searchInput instanceof HTMLInputElement) || !(searchClearButton instanceof HTMLElement)) return;
    const hidden = !searchInput.value.trim();
    searchClearButton.hidden = hidden;
    searchClearButton.toggleAttribute("hidden", hidden);
  }

  function syncPlayerSearchClearButton() {
    if (!(playerSearchInput instanceof HTMLInputElement) || !(playerSearchClearButton instanceof HTMLElement)) return;
    const hidden = !playerSearchInput.value.trim();
    playerSearchClearButton.hidden = hidden;
    playerSearchClearButton.toggleAttribute("hidden", hidden);
  }

  function syncPlanControls() {
    const hasClub = Boolean(plannerState.clubId);
    const owner = Boolean(plannerState.planId && plannerState.canEdit);
    const signedIn = walletOptedIn();
    if (planNameInput instanceof HTMLInputElement) {
      if (planNameInput.value !== plannerState.planName) planNameInput.value = plannerState.planName;
      planNameInput.disabled = !editable();
    }
    if (formationSelect instanceof HTMLSelectElement) formationSelect.disabled = !editable();
    if (searchInput instanceof HTMLInputElement) searchInput.disabled = plannerState.loading;
    if (playerSearchInput instanceof HTMLInputElement) playerSearchInput.disabled = !hasClub || !editable();
    if (savePlanButton) {
      savePlanButton.disabled = !hasClub || !editable() || !signedIn;
      savePlanButton.textContent = plannerState.planId ? (plannerState.dirty ? "Save Changes" : "Saved") : "Save Plan";
    }
    if (duplicatePlanButton) duplicatePlanButton.disabled = !plannerState.planId || !signedIn;
    if (sharePlanButton) {
      sharePlanButton.disabled = !owner || !signedIn;
      sharePlanButton.textContent = plannerState.visibility === "unlisted" ? "Stop Sharing" : "Share Plan";
    }
    if (newPlanButton) newPlanButton.disabled = false;
    if (sharedNotice instanceof HTMLElement) sharedNotice.hidden = !plannerState.planId || plannerState.canEdit;
    if (savedPlanSelect instanceof HTMLSelectElement) {
      savedPlanSelect.disabled = !signedIn || !plannerState.savedPlans.length;
      savedPlanSelect.value = plannerState.planId && plannerState.savedPlans.some((plan) => plan.id === plannerState.planId)
        ? plannerState.planId
        : "";
    }
  }

  function renderClubIdentity() {
    const identity = plannerState.club && typeof plannerState.club === "object" ? plannerState.club : {};
    const name = String(identity.name || identity.clubName || (plannerState.clubId ? "Team " + plannerState.clubId : "Select a team")).trim();
    if (clubName instanceof HTMLElement) clubName.textContent = name;
    if (searchInput instanceof HTMLInputElement && plannerState.clubId && document.activeElement !== searchInput) searchInput.value = name;
    syncSearchClearButton();

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
      Object.values(formations).forEach((formation) => {
        const option = document.createElement("option");
        option.value = formation.id;
        option.textContent = formation.name;
        formationSelect.appendChild(option);
      });
    }
    formationSelect.value = plannerState.formationId;
    syncPlanDropdowns();
  }

  function renderPitch() {
    if (!(pitch instanceof HTMLElement)) return;
    const formation = formations[plannerState.formationId] || formations[DEFAULT_FORMATION];
    const slots = formation?.slots || [];
    const depthChart = depthChartForFormation();
    const fragment = document.createDocumentFragment();
    const fieldLines = PITCH_LINE_CLASSES.map((className) => {
      const line = document.createElement("span");
      line.className = "pitchLine " + className;
      line.setAttribute("aria-hidden", "true");
      return line;
    });
    slots.forEach(({ id: slotId, position, x, y }) => {
      const slot = document.createElement("div");
      slot.className = "plannerSlot plannerDepthSlot";
      slot.dataset.slotId = slotId;
      slot.style.setProperty("--planner-x", x + "%");
      slot.style.setProperty("--planner-y", y + "%");
      if (plannerState.loading) slot.classList.add("is-loading");

      const labelNode = document.createElement("span");
      labelNode.className = "plannerSlotLabel";
      labelNode.textContent = position;
      slot.appendChild(labelNode);

      if (plannerState.loading) {
        const skeleton = document.createElement("span");
        skeleton.className = "plannerDepthList plannerDepthSkeleton";
        for (let index = 0; index < 2; index += 1) {
          const line = document.createElement("span");
          line.className = "plannerDepthSkeletonLine";
          line.textContent = "Loading player";
          skeleton.appendChild(line);
        }
        slot.appendChild(skeleton);
        slot.setAttribute("aria-label", "Loading " + position + " squad depth");
      } else {
        const depth = depthChart.get(slotId) || [];
        const list = document.createElement("span");
        list.className = "plannerDepthList";
        depth.slice(0, 4).forEach((player, index) => {
          const row = document.createElement("span");
          row.className = "plannerDepthPlayer";
          row.dataset.playerId = player.id;
          const rank = document.createElement("span");
          rank.className = "plannerDepthRank";
          rank.textContent = String(index + 1);
          const name = document.createElement("span");
          name.className = "plannerDepthName";
          name.textContent = player.name;
          const overall = document.createElement("span");
          overall.className = "plannerDepthOverall";
          overall.textContent = player.overall === null ? "—" : String(player.overall);
          row.append(rank, name, overall);
          list.appendChild(row);
        });
        if (!depth.length) {
          const empty = document.createElement("span");
          empty.className = "plannerDepthEmpty";
          empty.textContent = "No players";
          list.appendChild(empty);
        } else if (depth.length > 4) {
          const more = document.createElement("span");
          more.className = "plannerDepthMore";
          more.textContent = "+" + (depth.length - 4) + " more";
          list.appendChild(more);
        }
        slot.appendChild(list);
        slot.setAttribute("aria-label", position + " squad depth: " + (depth.length ? depth.map((player) => player.name).join(", ") : "No players"));
      }
      fragment.appendChild(slot);
    });
    pitch.replaceChildren(...fieldLines, fragment);
  }

  function renderRoster() {
    if (!(roster instanceof HTMLElement)) return;
    if (plannerState.loading) {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 8; index += 1) {
        const row = document.createElement("div");
        row.className = "plannerPlayer plannerPlayerSkeleton";
        row.setAttribute("aria-hidden", "true");
        const identity = document.createElement("span");
        identity.className = "plannerPlayerSkeletonIdentity";
        const name = document.createElement("span");
        name.className = "plannerPlayerSkeletonLine plannerPlayerSkeletonName";
        const meta = document.createElement("span");
        meta.className = "plannerPlayerSkeletonLine plannerPlayerSkeletonMeta";
        identity.append(name, meta);
        const overall = document.createElement("span");
        overall.className = "plannerPlayerSkeletonLine plannerPlayerSkeletonOverall";
        row.append(identity, overall);
        fragment.appendChild(row);
      }
      roster.replaceChildren(fragment);
      if (rosterCount instanceof HTMLElement) rosterCount.textContent = "—";
      return;
    }

    const squad = squadPlayersSorted();
    const fragment = document.createDocumentFragment();
    squad.forEach((player) => {
      const row = document.createElement("div");
      row.className = "plannerPlayer";
      row.dataset.playerId = player.id;
      const identity = document.createElement("span");
      identity.className = "plannerPlayerIdentity";
      const name = document.createElement("span");
      name.className = "plannerPlayerName";
      name.textContent = player.name;
      const meta = document.createElement("span");
      meta.className = "plannerPlayerMeta";
      meta.textContent = [player.positions.join(" / ") || "—", "#" + player.id].join(" · ");
      identity.append(name, meta);
      const overall = document.createElement("span");
      overall.className = "plannerPlayerOverall";
      overall.textContent = player.overall === null ? "—" : String(player.overall);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "iconButton popupCloseButton plannerPlayerRemove";
      remove.setAttribute("aria-label", "Remove " + player.name + " from squad");
      remove.disabled = !editable();
      remove.addEventListener("click", () => {
        if (!editable()) return;
        plannerState.squadPlayers.delete(player.id);
        plannerState.plannedSquadPlayerIds = squadPlayerIds();
        markDirty();
        renderWorkspace();
        setStatus(player.name + " removed from the planned squad.");
      });
      row.append(identity, overall, remove);
      fragment.appendChild(row);
    });
    roster.replaceChildren(fragment);
    if (rosterCount instanceof HTMLElement) rosterCount.textContent = String(squad.length);
  }

  function renderWorkspace() {
    renderClubIdentity();
    renderFormationOptions();
    renderPitch();
    renderRoster();
    if (workspace instanceof HTMLElement) {
      workspace.hidden = !plannerState.clubId || plannerState.loading;
      if (plannerState.loading) workspace.setAttribute("aria-busy", "true");
      else workspace.removeAttribute("aria-busy");
    }
    syncPlanControls();
  }

  function renderPlannerLoadingState(clubId, { resetSquad = true } = {}) {
    const normalizedClubId = String(clubId || "").trim();
    plannerState.loading = true;
    plannerState.clubId = normalizedClubId;
    plannerState.club = { clubId: normalizedClubId };
    plannerState.columns = [];
    plannerState.rows = [];
    if (resetSquad) {
      plannerState.squadPlayers = new Map();
      plannerState.plannedSquadPlayerIds = null;
      plannerState.formationId = DEFAULT_FORMATION;
    }
    renderWorkspace();
  }

  function resetPlanIdentity({ preserveClub = true } = {}) {
    plannerState.planId = "";
    plannerState.planName = "My plan";
    plannerState.canEdit = true;
    plannerState.visibility = "private";
    plannerState.revision = 0;
    plannerState.dirty = false;
    plannerState.loading = false;
    plannerState.formationId = DEFAULT_FORMATION;
    plannerState.plannedSquadPlayerIds = null;
    if (preserveClub && plannerState.clubId) {
      setSquadFromClubRows();
    } else if (!preserveClub) {
      plannerState.clubId = "";
      plannerState.club = null;
      plannerState.columns = [];
      plannerState.rows = [];
      plannerState.squadPlayers = new Map();
      if (searchInput instanceof HTMLInputElement) searchInput.value = "";
    }
    if (playerSearchInput instanceof HTMLInputElement) playerSearchInput.value = "";
    if (playerSearchResults instanceof HTMLElement) {
      playerSearchResults.hidden = true;
      playerSearchResults.replaceChildren();
    }
    syncPlayerSearchClearButton();
  }

  function newPlan({ preserveClub = true, updateUrl = true } = {}) {
    resetPlanIdentity({ preserveClub });
    renderWorkspace();
    if (updateUrl) setCanonicalUrl({ planId: "", clubId: plannerState.clubId, replace: false });
    setStatus(plannerState.clubId ? "New private plan. Edit the squad list or change formation." : "Choose a Club to start planning.");
  }

  async function hydratePlannedSquadPlayers() {
    const requested = Array.isArray(plannerState.plannedSquadPlayerIds)
      ? [...new Set(plannerState.plannedSquadPlayerIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 50)
      : null;
    if (requested === null) {
      setSquadFromClubRows();
      return;
    }
    const known = new Map();
    plannerState.rows.forEach((row) => {
      const player = plannerPlayerFromRow(row);
      if (player?.id) known.set(player.id, player);
    });
    const missing = requested.filter((id) => !known.has(id));
    if (missing.length) {
      const parameters = new URLSearchParams({
        mode: "search",
        type: "recent",
        playerIds: missing.join(","),
        excludeRetired: "1",
      });
      const response = await window.__mflDataClient.fetch("/api/data?" + parameters, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not restore planned squad players.");
      const columns = Array.isArray(payload?.players?.columns) ? payload.players.columns : [];
      const rows = Array.isArray(payload?.players?.rows) ? payload.players.rows : [];
      rows.forEach((row) => {
        const player = plannerPlayerFromRow(row, columns);
        if (player?.id && !player.retired) known.set(player.id, player);
      });
    }
    const next = new Map();
    requested.forEach((id) => {
      const player = known.get(id);
      if (player) next.set(id, player);
    });
    plannerState.squadPlayers = next;
    plannerState.plannedSquadPlayerIds = squadPlayerIds();
  }

  async function loadClub(clubId, options = {}) {
    const updateUrl = options.updateUrl !== false;
    const resetSquad = options.resetSquad ?? options.resetAssignments ?? true;
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) {
      plannerState.clubId = "";
      plannerState.club = null;
      plannerState.columns = [];
      plannerState.rows = [];
      if (resetSquad) {
        plannerState.squadPlayers = new Map();
        plannerState.plannedSquadPlayerIds = null;
      }
      renderWorkspace();
      if (updateUrl) setCanonicalUrl({ planId: "", clubId: "" });
      return false;
    }

    const sequence = ++plannerState.requestSequence;
    setStatus("Loading Club…");
    try {
      const routeCache = Reflect.get(window, "__mflRouteDataCache");
      const cachedPayload = routeCache?.readClubPayload?.(normalizedClubId) || null;
      let payload = cachedPayload;

      if (!payload) {
        renderPlannerLoadingState(normalizedClubId, { resetSquad });
        const requestPath = String(routeCache?.clubRequestPath?.(normalizedClubId) || "");
        if (!requestPath) throw new Error("Canonical Club request is unavailable.");
        const response = await window.__mflDataClient.fetch(requestPath, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Could not load this Club.");
        routeCache?.rememberClubPayload?.(normalizedClubId, payload);
      }

      if (sequence !== plannerState.requestSequence || state.currentPage !== PAGE) return false;

      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const columns = Array.isArray(payload?.columns) ? payload.columns : [];
      if (!rows.length && !payload?.club) throw new Error("Club not found.");

      plannerState.loading = false;
      plannerState.clubId = normalizedClubId;
      plannerState.club = payload?.club && typeof payload.club === "object"
        ? { ...payload.club, clubId: normalizedClubId }
        : { clubId: normalizedClubId };
      plannerState.columns = columns;
      plannerState.rows = rows;
      if (resetSquad) {
        plannerState.formationId = DEFAULT_FORMATION;
        setSquadFromClubRows();
        markDirty();
      } else {
        await hydratePlannedSquadPlayers();
      }
      if (updateUrl && !plannerState.planId) setCanonicalUrl({ clubId: normalizedClubId });
      renderWorkspace();
      setStatus(plannerState.squadPlayers.size + " players in the planned squad. Edit the squad list or change formation.");
      return true;
    } catch (error) {
      if (sequence !== plannerState.requestSequence || state.currentPage !== PAGE) return false;
      plannerState.loading = false;
      renderWorkspace();
      setStatus(error?.message || "Could not load this Club.");
      return false;
    } finally {
      if (sequence === plannerState.requestSequence) plannerState.loading = false;
      workspace?.removeAttribute("aria-busy");
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
      const name = String(club?.name || club?.clubName || (id ? "Team " + id : "")).trim();
      if (!id || !name) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "searchResult clubSearchResult plannerClubSearchResult";
      button.setAttribute("role", "option");
      button.dataset.clubId = id;

      const division = contractDivisionInfo(club?.division);
      const divisionHtml = division
        ? ` &middot; <span class="clubSearchDivision" style="color:${escapeHtml(division.color)}">${escapeHtml(division.name)}</span>`
        : "";
      button.innerHTML = `<strong>${escapeHtml(name)}</strong><span>Club &middot; #${escapeHtml(id)}${divisionHtml}</span>`;
      button.addEventListener("click", () => {
        searchResults.hidden = true;
        searchResults.replaceChildren();
        if (searchInput instanceof HTMLInputElement) searchInput.value = name;
        syncSearchClearButton();
        if (plannerState.planId) resetPlanIdentity({ preserveClub: false });
        void loadClub(id, { resetSquad: true });
      });
      fragment.appendChild(button);
    });
    searchResults.replaceChildren(fragment);
    searchResults.hidden = !searchResults.childElementCount;
  }

  async function searchClubs(query) {
    const normalized = String(query || "").trim();
    if (!normalized) {
      searchSequence += 1;
      state.clubSearchIndex = [];
      renderSearchResults([]);
      return;
    }

    const sequence = ++searchSequence;
    try {
      const applied = await requestDatabaseSearch(normalized, "clubs", {
        force: true,
        activeInput: () => searchInput?.value || "",
      });
      if (!applied || sequence !== searchSequence) return;
      const normalizedQuery = normalizeSearchText(normalized);
      const clubs = (Array.isArray(state.clubSearchIndex) ? state.clubSearchIndex : [])
        .filter((club) => club.searchText.includes(normalizedQuery))
        .sort((left, right) => (
          (left.division ?? Number.POSITIVE_INFINITY) - (right.division ?? Number.POSITIVE_INFINITY)
          || left.name.localeCompare(right.name)
        ))
        .slice(0, 10);
      renderSearchResults(clubs);
    } catch (error) {
      if (sequence !== searchSequence) return;
      renderSearchResults([]);
      setStatus(error?.message || "Could not search Clubs.");
    }
  }

  function renderPlayerSearchResults(entries) {
    if (!(playerSearchResults instanceof HTMLElement)) return;
    const players = Array.isArray(entries)
      ? entries.filter((entry) => {
          const player = plannerPlayerFromSearchEntry(entry);
          return player && !player.retired && !plannerState.squadPlayers.has(player.id);
        })
      : [];
    if (!players.length) {
      playerSearchResults.hidden = true;
      playerSearchResults.replaceChildren();
      return;
    }
    const fragment = document.createDocumentFragment();
    players.slice(0, 20).forEach((entry) => {
      const player = plannerPlayerFromSearchEntry(entry);
      if (!player) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "searchResult plannerPlayerSearchResult";
      button.setAttribute("role", "option");
      button.dataset.playerId = player.id;
      const name = document.createElement("strong");
      name.textContent = player.name;
      const meta = document.createElement("span");
      meta.textContent = [player.overall === null ? "" : "OVR " + player.overall, player.positions.join(" / "), "#" + player.id].filter(Boolean).join(" · ");
      button.append(name, meta);
      button.addEventListener("click", () => {
        if (!editable() || player.retired || plannerState.squadPlayers.has(player.id)) return;
        plannerState.squadPlayers.set(player.id, player);
        plannerState.plannedSquadPlayerIds = squadPlayerIds();
        if (playerSearchInput instanceof HTMLInputElement) playerSearchInput.value = "";
        renderPlayerSearchResults([]);
        syncPlayerSearchClearButton();
        markDirty();
        renderWorkspace();
        setStatus(player.name + " added to the planned squad.");
      });
      fragment.appendChild(button);
    });
    playerSearchResults.replaceChildren(fragment);
    playerSearchResults.hidden = !playerSearchResults.childElementCount;
  }

  async function searchPlayers(query) {
    const normalized = String(query || "").trim();
    if (!normalized) {
      playerSearchSequence += 1;
      renderPlayerSearchResults([]);
      return;
    }
    const sequence = ++playerSearchSequence;
    try {
      const applied = await requestDatabaseSearch(normalized, "players", {
        force: true,
        activeInput: () => playerSearchInput?.value || "",
      });
      if (!applied || sequence !== playerSearchSequence) return;
      const normalizedQuery = normalizeSearchText(normalized);
      const players = (Array.isArray(state.evaluationSearchIndex) ? state.evaluationSearchIndex : [])
        .filter((entry) => (
          !entry.retired
          && !plannerState.squadPlayers.has(String(entry.playerId || ""))
          && (entry.id.includes(normalizedQuery) || entry.name.includes(normalizedQuery))
        ))
        .sort((left, right) => Number(right.overall || 0) - Number(left.overall || 0) || String(left.nameDisplay || "").localeCompare(String(right.nameDisplay || "")));
      renderPlayerSearchResults(players);
    } catch (error) {
      if (sequence !== playerSearchSequence) return;
      renderPlayerSearchResults([]);
      setStatus(error?.message || "Could not search players.");
    }
  }

  function snapshot() {
    return {
      name: String(plannerState.planName || "My plan").trim() || "My plan",
      clubId: plannerState.clubId,
      formationId: plannerState.formationId,
      assignments: {},
      squadPlayerIds: squadPlayerIds(),
    };
  }

  async function plannerRequest(path = "", options = {}) {
    const response = await fetch(PLANS_API + path, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = /** @type {Error & { status?: number }} */ (new Error(payload?.error || "Could not update Planner."));
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function applyPlan(plan) {
    plannerState.planId = String(plan?.id || "");
    plannerState.planName = String(plan?.name || "My plan").trim() || "My plan";
    plannerState.clubId = String(plan?.clubId || "");
    plannerState.formationId = formations[plan?.formationId] ? plan.formationId : DEFAULT_FORMATION;
    plannerState.plannedSquadPlayerIds = Array.isArray(plan?.squadPlayerIds)
      ? plan.squadPlayerIds.map((id) => String(id || "").trim()).filter(Boolean)
      : null;
    plannerState.squadPlayers = new Map();
    plannerState.canEdit = Boolean(plan?.canEdit);
    plannerState.visibility = plan?.visibility === "unlisted" ? "unlisted" : "private";
    plannerState.revision = Number.isSafeInteger(plan?.revision) ? plan.revision : 1;
    plannerState.dirty = false;
  }

  async function loadPlan(planId, { updateUrl = true } = {}) {
    const normalized = String(planId || "").trim();
    if (!normalized) return false;
    const sequence = ++planSequence;
    setStatus("Loading plan…");
    try {
      const payload = await plannerRequest("?id=" + encodeURIComponent(normalized));
      if (sequence !== planSequence || state.currentPage !== PAGE) return false;
      const plan = payload?.plan;
      if (!plan) throw new Error("Plan not found.");
      applyPlan(plan);
      const loaded = await loadClub(plannerState.clubId, { updateUrl: false, resetSquad: false });
      if (!loaded || sequence !== planSequence) return false;
      if (updateUrl) setCanonicalUrl({ planId: plannerState.planId, replace: true });
      renderWorkspace();
      setStatus(plannerState.canEdit ? "Saved plan loaded." : "Shared plan loaded read-only. Duplicate it to make your own copy.");
      return true;
    } catch (error) {
      if (sequence !== planSequence) return false;
      setStatus(error?.message || "Could not load this plan.");
      return false;
    }
  }

  async function refreshSavedPlans() {
    if (!(savedPlanSelect instanceof HTMLSelectElement)) return;
    if (!walletOptedIn()) {
      plannerState.savedPlans = [];
      savedPlanSelect.replaceChildren(new Option("Opt in to load saved plans", ""));
      syncPlanControls();
      syncPlanDropdowns();
      return;
    }
    try {
      const payload = await plannerRequest("");
      plannerState.savedPlans = Array.isArray(payload?.plans) ? payload.plans : [];
      const options = [new Option("Current plan", "")];
      plannerState.savedPlans.forEach((plan) => {
        options.push(new Option(String(plan.name || "Untitled plan"), String(plan.id || "")));
      });
      savedPlanSelect.replaceChildren(...options);
    } catch (error) {
      plannerState.savedPlans = [];
      savedPlanSelect.replaceChildren(new Option("Saved plans unavailable", ""));
    }
    syncPlanControls();
    syncPlanDropdowns();
  }

  async function savePlan() {
    if (!editable() || !plannerState.clubId) return;
    plannerState.planName = String(planNameInput?.value || plannerState.planName || "My plan").trim() || "My plan";
    setStatus(plannerState.planId ? "Saving changes…" : "Saving plan…");
    try {
      const body = snapshot();
      const existingPlanId = plannerState.planId;
      const payload = existingPlanId
        ? await plannerRequest("?id=" + encodeURIComponent(existingPlanId), {
            method: "PUT",
            body: JSON.stringify({ ...body, revision: plannerState.revision }),
          })
        : await plannerRequest("", { method: "POST", body: JSON.stringify(body) });
      applyPlan(payload.plan);
      setCanonicalUrl({ planId: plannerState.planId, replace: Boolean(existingPlanId) });
      await refreshSavedPlans();
      renderWorkspace();
      setStatus("Plan saved.");
    } catch (error) {
      setStatus(error?.status === 401 ? "Opt in to save plans." : error?.message || "Could not save this plan.");
    }
  }

  async function duplicatePlan() {
    if (!plannerState.planId) return;
    setStatus("Duplicating plan…");
    try {
      const payload = await plannerRequest("", {
        method: "POST",
        body: JSON.stringify({ sourceId: plannerState.planId }),
      });
      applyPlan(payload.plan);
      await loadClub(plannerState.clubId, { updateUrl: false, resetSquad: false });
      setCanonicalUrl({ planId: plannerState.planId, replace: false });
      await refreshSavedPlans();
      renderWorkspace();
      setStatus("Private editable copy created.");
    } catch (error) {
      setStatus(error?.status === 401 ? "Opt in to duplicate this plan." : error?.message || "Could not duplicate this plan.");
    }
  }

  async function toggleShare() {
    if (!plannerState.planId || !plannerState.canEdit) return;
    const nextShared = plannerState.visibility !== "unlisted";
    setStatus(nextShared ? "Enabling sharing…" : "Stopping sharing…");
    try {
      const shareUpdate = nextShared
        ? { shared: true, revision: plannerState.revision }
        : { shared: false, revision: plannerState.revision };
      const payload = await plannerRequest("?id=" + encodeURIComponent(plannerState.planId), {
        method: "PATCH",
        body: JSON.stringify(shareUpdate),
      });
      applyPlan(payload.plan);
      renderWorkspace();
      if (nextShared) {
        const link = window.location.origin + BASE_PATH + "/" + encodeURIComponent(plannerState.planId);
        try { await navigator.clipboard?.writeText?.(link); } catch {}
        setStatus("Sharing enabled. The stable plan link is ready" + (navigator.clipboard ? " and copied." : "."));
      } else {
        setStatus("Sharing stopped. Other visitors can no longer open this plan.");
      }
      await refreshSavedPlans();
    } catch (error) {
      setStatus(error?.message || "Could not update sharing.");
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
    syncPlanDropdowns();

    try {
      await ensureFormations();
    } catch (error) {
      setStatus(error?.message || "Could not load Planner formations.");
      syncPlanControls();
      return false;
    }

    const requestedPlanId = String(options.planId || "").trim();
    const requestedClubId = String(options.clubId || queryClubId() || "").trim();
    await refreshSavedPlans();

    if (requestedPlanId) {
      if (requestedPlanId !== plannerState.planId) await loadPlan(requestedPlanId, { updateUrl: updateHash });
      else renderWorkspace();
    } else if (requestedClubId) {
      if (plannerState.planId || requestedClubId !== plannerState.clubId) {
        resetPlanIdentity({ preserveClub: false });
        await loadClub(requestedClubId, { updateUrl: updateHash, resetSquad: true });
      } else {
        renderWorkspace();
      }
    } else {
      if (plannerState.planId) resetPlanIdentity({ preserveClub: false });
      renderWorkspace();
      setStatus(plannerState.clubId ? "Edit the squad list or change formation." : "Choose a Club to start planning.");
    }

    syncHomeLoginButton?.();
    Reflect.get(window, "__mflDocumentTitleRuntime")?.sync?.();
    return true;
  }

  planNameInput?.addEventListener("input", () => {
    if (!editable()) return;
    plannerState.planName = planNameInput.value;
    markDirty();
  });

  formationSelect?.addEventListener("change", () => {
    if (!editable()) return;
    const next = String(formationSelect.value || "");
    if (!formations[next] || next === plannerState.formationId) return;
    plannerState.formationId = next;
    markDirty();
    renderWorkspace();
    setStatus("Formation changed. Squad depths updated.");
  });

  savedPlanSelect?.addEventListener("change", () => {
    const planId = String(savedPlanSelect.value || "").trim();
    if (!planId || planId === plannerState.planId) return;
    setCanonicalUrl({ planId, replace: false });
    void loadPlan(planId, { updateUrl: false });
  });

  searchInput?.addEventListener("input", () => {
    syncSearchClearButton();
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void searchClubs(searchInput.value), 140);
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const firstResult = searchResults?.querySelector(".plannerClubSearchResult");
      if (firstResult instanceof HTMLButtonElement) {
        event.preventDefault();
        firstResult.click();
      }
      return;
    }
    if (event.key === "Escape") {
      if (searchResults instanceof HTMLElement) {
        searchResults.hidden = true;
        searchResults.replaceChildren();
      }
      searchInput.blur();
    }
  });

  searchClearButton?.addEventListener("click", () => {
    if (!(searchInput instanceof HTMLInputElement)) return;
    window.clearTimeout(searchTimer);
    searchSequence += 1;
    searchInput.value = "";
    syncSearchClearButton();
    renderSearchResults([]);
    searchInput.focus();
  });

  playerSearchInput?.addEventListener("input", () => {
    syncPlayerSearchClearButton();
    window.clearTimeout(playerSearchTimer);
    playerSearchTimer = window.setTimeout(() => void searchPlayers(playerSearchInput.value), 140);
  });

  playerSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const firstResult = playerSearchResults?.querySelector(".plannerPlayerSearchResult");
      if (firstResult instanceof HTMLButtonElement) {
        event.preventDefault();
        firstResult.click();
      }
      return;
    }
    if (event.key === "Escape") {
      if (playerSearchResults instanceof HTMLElement) {
        playerSearchResults.hidden = true;
        playerSearchResults.replaceChildren();
      }
      playerSearchInput.blur();
    }
  });

  playerSearchClearButton?.addEventListener("click", () => {
    if (!(playerSearchInput instanceof HTMLInputElement)) return;
    window.clearTimeout(playerSearchTimer);
    playerSearchSequence += 1;
    playerSearchInput.value = "";
    syncPlayerSearchClearButton();
    renderPlayerSearchResults([]);
    playerSearchInput.focus();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (searchResults instanceof HTMLElement && !searchResults.hidden
        && target !== searchInput && !(target instanceof Node && searchResults.contains(target))) {
      searchResults.hidden = true;
    }
    if (playerSearchResults instanceof HTMLElement && !playerSearchResults.hidden
        && target !== playerSearchInput && !(target instanceof Node && playerSearchResults.contains(target))) {
      playerSearchResults.hidden = true;
    }
  });

  newPlanButton?.addEventListener("click", () => newPlan({ preserveClub: true, updateUrl: true }));
  savePlanButton?.addEventListener("click", () => void savePlan());
  duplicatePlanButton?.addEventListener("click", () => void duplicatePlan());
  sharePlanButton?.addEventListener("click", () => void toggleShare());

  Reflect.set(window, "__mflRenderPlannerPageOwner", renderRoute);
  Reflect.set(window, "__mflPlannerRoute", Object.freeze({
    loadClub,
    loadPlan,
    reset: newPlan,
    depthChartForFormation,
    formations,
  }));
})();
