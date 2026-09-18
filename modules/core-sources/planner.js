(() => {
  "use strict";

  const PAGE = "planner";
  const BASE_PATH = "/planner";
  const DEFAULT_FORMATION = "4-3-3";
  const PLANS_API = "/api/planner-plans";
  const formations = Object.freeze({
    "4-3-3": Object.freeze([
      ["GK", "GK", 50, 90], ["LW", "LW", 25, 15], ["ST", "ST", 50, 15], ["RW", "RW", 75, 15],
      ["LCM", "CM", 25, 45], ["CM", "CM", 50, 45], ["RCM", "CM", 75, 45],
      ["LB", "LB", 20, 75], ["LCB", "CB", 40, 75], ["RCB", "CB", 60, 75], ["RB", "RB", 80, 75],
    ]),
    "4-2-3-1": Object.freeze([
      ["GK", "GK", 50, 90], ["ST", "ST", 50, 15],
      ["LAM", "CAM", 25, 35], ["CAM", "CAM", 50, 35], ["RAM", "CAM", 75, 35],
      ["LDM", "CDM", 33.33, 55], ["RDM", "CDM", 66.67, 55],
      ["LB", "LB", 20, 75], ["LCB", "CB", 40, 75], ["RCB", "CB", 60, 75], ["RB", "RB", 80, 75],
    ]),
    "4-4-2": Object.freeze([
      ["GK", "GK", 50, 90], ["LST", "ST", 33.33, 15], ["RST", "ST", 66.67, 15],
      ["LM", "LM", 20, 45], ["LCM", "CM", 40, 45], ["RCM", "CM", 60, 45], ["RM", "RM", 80, 45],
      ["LB", "LB", 20, 75], ["LCB", "CB", 40, 75], ["RCB", "CB", 60, 75], ["RB", "RB", 80, 75],
    ]),
    "3-5-2": Object.freeze([
      ["GK", "GK", 50, 90], ["LST", "ST", 33.33, 15], ["RST", "ST", 66.67, 15],
      ["LWB", "LB", 16.67, 45], ["LCM", "CM", 33.33, 45], ["CM", "CM", 50, 45], ["RCM", "CM", 66.67, 45], ["RWB", "RB", 83.33, 45],
      ["LCB", "CB", 25, 75], ["CB", "CB", 50, 75], ["RCB", "CB", 75, 75],
    ]),
    "3-4-3": Object.freeze([
      ["GK", "GK", 50, 90], ["LW", "LW", 25, 15], ["ST", "ST", 50, 15], ["RW", "RW", 75, 15],
      ["LM", "LM", 20, 45], ["LCM", "CM", 40, 45], ["RCM", "CM", 60, 45], ["RM", "RM", 80, 45],
      ["LCB", "CB", 25, 75], ["CB", "CB", 50, 75], ["RCB", "CB", 75, 75],
    ]),
  });

  const page = document.getElementById("plannerPage");
  const workspace = document.getElementById("plannerWorkspace");
  const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("plannerClubSearchInput"));
  const searchResults = document.getElementById("plannerClubSearchResults");
  const searchClearButton = document.getElementById("plannerClubSearchClearButton");
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
    assignments: new Map(),
    selectedPlayerId: "",
    selectedFromSlotId: "",
    requestSequence: 0,
    planId: "",
    planName: "My plan",
    canEdit: true,
    visibility: "private",
    revision: 0,
    dirty: false,
    savedPlans: [],
  };

  const PITCH_LINE_CLASSES = Object.freeze([
    "pitchBoxTop", "pitchGoalTop", "pitchArcTop", "pitchBoxBottom", "pitchGoalBottom", "pitchArcBottom",
  ]);

  let searchTimer = 0;
  let searchSequence = 0;
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
    return !plannerState.planId || plannerState.canEdit;
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
      } catch {}
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

  function assignmentsObject() {
    return Object.fromEntries(Array.from(plannerState.assignments.entries()).filter(([, id]) => Boolean(id)));
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

  function syncSearchClearButton() {
    if (!(searchInput instanceof HTMLInputElement) || !(searchClearButton instanceof HTMLElement)) return;
    const hidden = !searchInput.value.trim();
    searchClearButton.hidden = hidden;
    searchClearButton.toggleAttribute("hidden", hidden);
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
    if (searchInput instanceof HTMLInputElement) searchInput.disabled = !editable();
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
    const name = String(identity.name || identity.clubName || (plannerState.clubId ? "Club " + plannerState.clubId : "Select a Club")).trim();
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
    const fieldLines = PITCH_LINE_CLASSES.map((className) => {
      const line = document.createElement("span");
      line.className = "pitchLine " + className;
      line.setAttribute("aria-hidden", "true");
      return line;
    });

    slots.forEach(([slotId, position, x, y]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "plannerSlot";
      button.dataset.slotId = slotId;
      button.style.setProperty("--planner-x", x + "%");
      button.style.setProperty("--planner-y", y + "%");
      button.disabled = !editable();

      const labelNode = document.createElement("span");
      labelNode.className = "plannerSlotLabel";
      labelNode.textContent = position;

      const assignedId = String(plannerState.assignments.get(slotId) || "");
      const row = assignedId ? rowByPlayerId(assignedId) : null;
      const playerNode = document.createElement("span");
      playerNode.className = "plannerSlotPlayer";
      const overallNode = document.createElement("span");
      overallNode.className = "plannerSlotOverall";

      if (assignedId) {
        const name = row ? playerName(row) : "Player " + assignedId;
        playerNode.textContent = name;
        const overall = row ? playerOverall(row) : null;
        overallNode.textContent = overall === null ? (row ? playerPositions(row).join(" / ") : "Unavailable") : "OVR " + overall;
        button.setAttribute("aria-label", position + ": " + name + (editable() ? ". Select to move or remove this player." : "."));
      } else {
        button.classList.add("is-empty");
        playerNode.textContent = "Select";
        overallNode.textContent = "Position";
        button.setAttribute("aria-label", "Empty " + position + " position");
      }

      button.append(labelNode, playerNode, overallNode);
      if (plannerState.selectedFromSlotId === slotId) button.classList.add("is-selected");
      button.addEventListener("click", () => {
        if (!editable()) return;
        if (plannerState.selectedPlayerId) {
          const selectedPlayerId = plannerState.selectedPlayerId;
          const sourceSlotId = plannerState.selectedFromSlotId;
          const targetPlayerId = String(plannerState.assignments.get(slotId) || "");

          if (sourceSlotId) {
            if (slotId === sourceSlotId) {
              plannerState.assignments.delete(sourceSlotId);
              setStatus("Player returned to the available roster.");
            } else {
              plannerState.assignments.set(slotId, selectedPlayerId);
              if (targetPlayerId && targetPlayerId !== selectedPlayerId) {
                plannerState.assignments.set(sourceSlotId, targetPlayerId);
                setStatus("Players swapped. Select another player to continue.");
              } else {
                plannerState.assignments.delete(sourceSlotId);
                setStatus("Player moved. Select another player to continue.");
              }
            }
          } else {
            for (const [assignedSlotId, assignedPlayerId] of plannerState.assignments.entries()) {
              if (assignedPlayerId === selectedPlayerId) plannerState.assignments.delete(assignedSlotId);
            }
            plannerState.assignments.set(slotId, selectedPlayerId);
            setStatus(targetPlayerId
              ? "Player assigned; the previous player returned to the available roster."
              : "Player assigned. Select another player to continue.");
          }

          plannerState.selectedPlayerId = "";
          plannerState.selectedFromSlotId = "";
          markDirty();
          renderWorkspace();
          return;
        }

        if (assignedId) {
          plannerState.selectedPlayerId = assignedId;
          plannerState.selectedFromSlotId = slotId;
          setStatus("Player selected. Choose another position to move or swap, or select this position again to remove the player.");
          renderWorkspace();
        }
      });

      fragment.appendChild(button);
    });

    pitch.replaceChildren(...fieldLines, fragment);
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
      button.disabled = !editable();

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
      const overallValue = playerOverall(row);
      overall.textContent = overallValue === null ? "—" : String(overallValue);

      button.append(identity, overall);
      button.addEventListener("click", () => {
        if (!editable()) return;
        const nextSelectedPlayerId = plannerState.selectedPlayerId === id && !plannerState.selectedFromSlotId ? "" : id;
        plannerState.selectedPlayerId = nextSelectedPlayerId;
        plannerState.selectedFromSlotId = "";
        setStatus(plannerState.selectedPlayerId ? "Player selected. Choose a position on the pitch." : "Player selection cleared.");
        renderWorkspace();
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
    syncPlanControls();
  }

  function resetPlanIdentity({ preserveClub = true } = {}) {
    plannerState.planId = "";
    plannerState.planName = "My plan";
    plannerState.canEdit = true;
    plannerState.visibility = "private";
    plannerState.revision = 0;
    plannerState.dirty = false;
    plannerState.assignments.clear();
    plannerState.selectedPlayerId = "";
    plannerState.selectedFromSlotId = "";
    plannerState.formationId = DEFAULT_FORMATION;
    if (!preserveClub) {
      plannerState.clubId = "";
      plannerState.club = null;
      plannerState.columns = [];
      plannerState.rows = [];
      if (searchInput instanceof HTMLInputElement) searchInput.value = "";
    }
  }

  function newPlan({ preserveClub = true, updateUrl = true } = {}) {
    resetPlanIdentity({ preserveClub });
    renderWorkspace();
    if (updateUrl) setCanonicalUrl({ planId: "", clubId: plannerState.clubId, replace: false });
    setStatus(plannerState.clubId ? "New private plan. Select players and save when ready." : "Choose a Club to start planning.");
  }

  async function loadClub(clubId, { updateUrl = true, resetAssignments = true } = {}) {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) {
      plannerState.clubId = "";
      plannerState.club = null;
      plannerState.columns = [];
      plannerState.rows = [];
      if (resetAssignments) plannerState.assignments.clear();
      renderWorkspace();
      if (updateUrl) setCanonicalUrl({ planId: "", clubId: "" });
      return false;
    }

    const sequence = ++plannerState.requestSequence;
    setStatus("Loading Club…");
    workspace?.setAttribute("aria-busy", "true");
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
      if (resetAssignments) {
        plannerState.assignments.clear();
        plannerState.selectedPlayerId = "";
        plannerState.formationId = DEFAULT_FORMATION;
        markDirty();
      }
      if (updateUrl && !plannerState.planId) setCanonicalUrl({ clubId: normalizedClubId });
      renderWorkspace();
      setStatus(rows.length + " players loaded. Select a player, then a position.");
      return true;
    } catch (error) {
      if (sequence !== plannerState.requestSequence || state.currentPage !== PAGE) return false;
      setStatus(error?.message || "Could not load this Club.");
      return false;
    } finally {
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
      const name = String(club?.name || club?.clubName || (id ? "Club " + id : "")).trim();
      if (!id || !name) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "searchResult plannerClubSearchResult";
      button.setAttribute("role", "option");
      button.dataset.clubId = id;
      const nameNode = document.createElement("strong");
      nameNode.textContent = name;
      const metaNode = document.createElement("span");
      const division = String(club?.divisionName || club?.division || "").trim();
      metaNode.textContent = ["Club #" + id, division ? "Division " + division : ""].filter(Boolean).join(" · ");
      button.append(nameNode, metaNode);
      button.addEventListener("click", () => {
        searchResults.hidden = true;
        searchResults.replaceChildren();
        if (searchInput instanceof HTMLInputElement) searchInput.value = name;
        syncSearchClearButton();
        void loadClub(id);
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
        .slice(0, 20);
      renderSearchResults(clubs);
    } catch (error) {
      if (sequence !== searchSequence) return;
      renderSearchResults([]);
      setStatus(error?.message || "Could not search Clubs.");
    }
  }

  function snapshot() {
    return {
      name: String(plannerState.planName || "My plan").trim() || "My plan",
      clubId: plannerState.clubId,
      formationId: plannerState.formationId,
      assignments: assignmentsObject(),
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
    plannerState.assignments = new Map(Object.entries(plan?.assignments && typeof plan.assignments === "object" ? plan.assignments : {}));
    plannerState.canEdit = Boolean(plan?.canEdit);
    plannerState.visibility = plan?.visibility === "unlisted" ? "unlisted" : "private";
    plannerState.revision = Number.isSafeInteger(plan?.revision) ? plan.revision : 1;
    plannerState.dirty = false;
    plannerState.selectedPlayerId = "";
    plannerState.selectedFromSlotId = "";
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
      const loaded = await loadClub(plannerState.clubId, { updateUrl: false, resetAssignments: false });
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
      await loadClub(plannerState.clubId, { updateUrl: false, resetAssignments: false });
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

    const requestedPlanId = String(options.planId || "").trim();
    const requestedClubId = String(options.clubId || queryClubId() || "").trim();
    await refreshSavedPlans();

    if (requestedPlanId) {
      if (requestedPlanId !== plannerState.planId) await loadPlan(requestedPlanId, { updateUrl: updateHash });
      else renderWorkspace();
    } else if (requestedClubId) {
      if (plannerState.planId || requestedClubId !== plannerState.clubId) {
        resetPlanIdentity({ preserveClub: false });
        await loadClub(requestedClubId, { updateUrl: updateHash, resetAssignments: true });
      } else {
        renderWorkspace();
      }
    } else {
      if (plannerState.planId) resetPlanIdentity({ preserveClub: false });
      renderWorkspace();
      setStatus(plannerState.clubId ? "Select a player, then a position." : "Choose a Club to start planning.");
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
    plannerState.assignments.clear();
    plannerState.selectedPlayerId = "";
    plannerState.selectedFromSlotId = "";
    markDirty();
    renderWorkspace();
    setStatus("Formation changed. Player assignments were reset.");
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

  document.addEventListener("click", (event) => {
    if (!(searchResults instanceof HTMLElement) || searchResults.hidden) return;
    const target = event.target;
    if (target === searchInput || (target instanceof Node && searchResults.contains(target))) return;
    searchResults.hidden = true;
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
    formations,
  }));
})();
