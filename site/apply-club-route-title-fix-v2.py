from pathlib import Path
import json

root = Path(__file__).resolve().parent


def replace_section(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    end = text.find(end_marker, start + len(start_marker)) if start >= 0 else -1
    if start < 0 or end < 0:
        raise RuntimeError(f"Could not patch {label}")
    return text[:start] + replacement + text[end:]


def replace_required(text: str, before: str, after: str, label: str) -> str:
    if before not in text:
        raise RuntimeError(f"Could not patch {label}")
    return text.replace(before, after, 1)


# Strict Club route parser and immediate invalid-route redirect.
path = root / "modules" / "app-config.js"
text = path.read_text(encoding="utf-8")
text = replace_section(
    text,
    "  function clubRoute(pathname = location.pathname) {",
    "\n\n  function initialRequest(pathname = location.pathname) {",
    '''  function clubRoute(pathname = location.pathname) {
    const path = String(pathname || "/").split("?")[0].replace(/\\/+$/, "") || "/";
    const match = path.match(/^\\/clubs\\/([^/]+)\\/(squad|contracts|current-season|all-time)$/i);
    if (!match) return null;

    const clubId = decodedRoutePart(match[1]);
    if (!clubId) return null;
    const requestedSlug = decodedRoutePart(match[2]).toLowerCase();
    const view = data.routes.viewBySlug[requestedSlug] || "";
    if (!data.routes.tableViews.club.order.includes(view)) return null;
    return Object.freeze({
      clubId,
      view,
      path: clubPath(clubId, view),
    });
  }''',
    "strict Club route parser",
)
start = text.find("  const initialClubRoute = routes.clubRoute(location.pathname);")
end = text.find("})();", start)
if start < 0 or end < 0:
    raise RuntimeError("Could not patch invalid Club startup redirect")
redirect_block = '''  const initialClubPath = String(location.pathname || "/");
  const initialClubLikePath = /^\\/(?:clubs|club)(?:\\/|$)/i.test(initialClubPath);
  const initialClubRoute = routes.clubRoute(initialClubPath);
  if (initialClubLikePath && !initialClubRoute) {
    location.replace("/");
  } else if (initialClubRoute && initialClubPath !== initialClubRoute.path) {
    history.replaceState({}, "", initialClubRoute.path + location.search + location.hash);
  }
'''
text = text[:start] + redirect_block + text[end:]
path.write_text(text, encoding="utf-8")

# Shared Club title ownership + Club-local stable title cache and invalid popstate/boot redirects.
path = root / "modules" / "app-core-route-chunks.js"
text = path.read_text(encoding="utf-8")
shared_insert_marker = '''  if (!core.trim()) {
    throw new Error("Cannot split an empty application core.");
  }
'''
shared_insert = shared_insert_marker + '''
  core = replaceRequired(
    core,
    `  if (pageName === "agents") {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }`,
    `  if (pageName === "agents") {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else if (pageName !== "club") {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }`,
    "Club view title stability",
  );
  core = replaceRequired(
    core,
    `      if (route.scope === "club") {
        const club = state.clubSearchIndex.find((entry) => entry.clubId === String(route.clubId || ""));
        tablePageTitle.textContent = club?.name || "Club";
      } else {
        tablePageTitle.textContent = tableTitleForPage(pageName);
      }`,
    `      if (route.scope !== "club") {
        tablePageTitle.textContent = tableTitleForPage(pageName);
      }`,
    "Club incremental title stability",
  );
'''
text = replace_required(text, shared_insert_marker, shared_insert, "shared Club title ownership")
club_marker = "  let club = extracted.chunk;\n"
club_insert = club_marker + '''
  club = replaceRequired(
    club,
    '  let activeClubId = "";\\n  let openingClub = false;',
    '  let activeClubId = "";\\n  let activeClubTitle = null;\\n  let openingClub = false;',
    "Club stable title state",
  );
  club = replaceFunction(
    club,
    "renderClubTitle",
    `  function renderClubTitle() {
    if (typeof tablePageTitle === "undefined" || !tablePageTitle) return;

    if (!activeClubTitle || activeClubTitle.clubId !== String(activeClubId)) {
      const division = clubDivision();
      activeClubTitle = {
        clubId: String(activeClubId),
        name: clubName(),
        division: division ? { name: division.name, color: division.color } : null,
      };
    }

    if (!activeClubTitle.division) {
      tablePageTitle.textContent = activeClubTitle.name;
      return;
    }

    const divisionLabel = document.createElement("span");
    divisionLabel.className = "clubPageTitleDivision";
    divisionLabel.style.color = activeClubTitle.division.color;
    divisionLabel.textContent = activeClubTitle.division.name;
    tablePageTitle.replaceChildren(
      document.createTextNode(\`\${activeClubTitle.name} - \`),
      divisionLabel,
    );
  }`,
    "stable Club title across views",
  );
  club = replaceRequired(
    club,
    '      activeClubId = String(clubId);\\n      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";',
    '      const nextClubId = String(clubId);\\n      if (nextClubId !== activeClubId) activeClubTitle = null;\\n      activeClubId = nextClubId;\\n      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";',
    "Club title cache invalidation",
  );
  club = replaceRequired(
    club,
    `  window.addEventListener("popstate", () => {
    const route = clubRoute();
    if (route) void openClubPage(route.clubId, route.view, false);
  });`,
    `  window.addEventListener("popstate", () => {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(path) && !route) {
      window.location.replace("/");
      return;
    }
    if (route) void openClubPage(route.clubId, route.view, false);
  });`,
    "invalid Club popstate redirect",
  );
  club = replaceFunction(
    club,
    "bootClubRoute",
    `  function bootClubRoute() {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(path) && !route) {
      window.location.replace("/");
      return;
    }
    if (!route || initialClubRoute) return;
    const canonicalRoute = canonicalClubRoute(route.clubId, route.view);
    if (path !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
    void openClubPage(route.clubId, route.view, false);
  }`,
    "strict Club route boot",
  );
'''
text = replace_required(text, club_marker, club_insert, "Club-local title/redirect ownership")
path.write_text(text, encoding="utf-8")

# Route behavior validation.
path = root / "validate-route-page-normalization.mjs"
text = path.read_text(encoding="utf-8")
text = replace_section(
    text,
    "for (const [path, expectedView, expectedPath] of [\n  [\"/clubs/123/squad\"",
    "\n\nfunction firstRuntimeClubPath(pathname) {",
    '''for (const [path, expectedView, expectedPath] of [
  ["/clubs/123/squad", "attributes", "/clubs/123/squad"],
  ["/clubs/123/contracts", "contracts", "/clubs/123/contracts"],
  ["/clubs/123/current-season", "current", "/clubs/123/current-season"],
  ["/clubs/123/all-time", "all", "/clubs/123/all-time"],
]) {
  const route = routeConfig.clubRoute(path);
  invariant(route?.clubId === "123", `${path} must preserve Club ID 123.`);
  invariant(route?.view === expectedView, `${path} must resolve to Club view ${expectedView}.`);
  invariant(route?.path === expectedPath, `${path} must remain ${expectedPath}.`);
}

for (const path of [
  "/clubs/123",
  "/clubs/123/attributes",
  "/clubs/123/current",
  "/clubs/123/all",
  "/clubs/123/unknown",
  "/club/123/contracts",
  "/clubs",
  "/club",
]) {
  invariant(routeConfig.clubRoute(path) === null, `${path} must be rejected as an invalid Club route.`);
}''',
    "strict Club route validator cases",
)
text = replace_required(
    text,
    '''  const runtimeLocation = {
    pathname,
    origin: "https://example.test",
    search: "?keep=1",
    hash: "#club",
  };''',
    '''  const runtimeLocation = {
    pathname,
    origin: "https://example.test",
    search: "?keep=1",
    hash: "#club",
    replace(target) {
      replacedPath = String(target || "");
      runtimeLocation.pathname = replacedPath.split(/[?#]/, 1)[0];
    },
  };''',
    "Club redirect test location",
)
start = text.find("for (const [path, expectedReplacement] of [")
end = text.find("\n\nconst routeCases = [", start)
if start < 0 or end < 0:
    raise RuntimeError("Could not patch first-runtime Club redirect tests")
text = text[:start] + '''for (const [path, expectedReplacement] of [
  ["/clubs/123", "/"],
  ["/clubs/123/attributes", "/"],
  ["/clubs/123/current", "/"],
  ["/clubs/123/unknown", "/"],
  ["/club/123/all-time", "/"],
  ["/clubs", "/"],
  ["/club", "/"],
  ["/clubs/123/squad", ""],
  ["/clubs/123/contracts", ""],
  ["/clubs/123/current-season", ""],
  ["/clubs/123/all-time", ""],
]) {
  invariant(
    firstRuntimeClubPath(path) === expectedReplacement,
    `${path} must ${expectedReplacement ? `redirect immediately to ${expectedReplacement}` : "already be a valid canonical Club route before loading"}.`,
  );
}''' + text[end:]
text = replace_required(
    text,
    '''  ["/clubs/123/current-season", "club", "current"],
  ["/club/123/contracts", "club", "contracts"],''',
    '''  ["/clubs/123/current-season", "club", "current"],
  ["/clubs/123", "home", ""],
  ["/clubs/123/attributes", "home", ""],
  ["/clubs/123/unknown", "home", ""],
  ["/club/123/contracts", "home", ""],''',
    "invalid Club startup classification",
)
text = text.replace(
    'console.log("Canonical route page-name, view, initial-route, and always-canonical Club URL validation passed.");',
    'console.log("Canonical route page-name, view, strict Club redirects, and canonical Club URL validation passed.");',
)
path.write_text(text, encoding="utf-8")

# Club-specific architecture validation.
path = root / "validate-club-route-core.mjs"
text = path.read_text(encoding="utf-8")
needle = 'includes(sharedCore, "setView = async function setIncrementalView(viewName) {", "Club must share the incremental setView owner with all table pages.");\n'
text = replace_required(
    text,
    needle,
    needle + 'includes(sharedCore, \'else if (pageName !== "club") {\', "Shared view rendering must not rewrite the Club title during a view switch.");\nexcludes(sharedCore, \'tablePageTitle.textContent = club?.name || "Club";\', "Incremental Club payloads must not replace the loaded Club title.");\n',
    "shared Club title validator",
)
needle = 'includes(clubCore, "function applyClubPresentation()", "The Club chunk must own Club presentation.");\n'
text = replace_required(
    text,
    needle,
    needle + 'includes(clubCore, "let activeClubTitle = null;", "The Club chunk must retain the loaded Club title identity across view switches.");\nincludes(clubCore, "if (nextClubId !== activeClubId) activeClubTitle = null;", "The stable Club title must reset only when navigating to another Club.");\nincludes(clubCore, "activeClubTitle.clubId !== String(activeClubId)", "Club title rendering must reuse the same Club identity across views.");\nincludes(clubCore, \'window.location.replace("/");\', "Invalid Club history or boot routes must redirect to the homepage.");\n',
    "Club title/redirect validator",
)
needle = 'includes(appConfig, "export const CLUB_VIEW_SLUGS", "Canonical app config must own Club view-to-slug mapping.");\n'
text = replace_required(
    text,
    needle,
    needle + 'includes(appConfig, "squad|contracts|current-season|all-time", "Club routing must expose only the four canonical public view slugs.");\nincludes(appConfig, \'initialClubLikePath && !initialClubRoute\', "Invalid Club startup paths must redirect before loading begins.");\n',
    "strict Club config validator",
)
path.write_text(text, encoding="utf-8")

# Version/cache key because the generated shared/Club core changes.
release_path = root / "release.json"
release = json.loads(release_path.read_text(encoding="utf-8"))
if release.get("version") != "1.124.59":
    raise RuntimeError(f"Expected release 1.124.59, found {release.get('version')}")
release["version"] = "1.124.60"
release["description"] = "Reject invalid Club routes and keep Club titles stable across views"
release_path.write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")

for relative in ["bootstrap.js", "bootstrap-core.js"]:
    target = root / relative
    source = target.read_text(encoding="utf-8")
    if "1.124.59" not in source:
        raise RuntimeError(f"Could not patch release version in {relative}")
    target.write_text(source.replace("1.124.59", "1.124.60"), encoding="utf-8")

history_path = root / "release-history-overrides.json"
history = json.loads(history_path.read_text(encoding="utf-8"))
if not history or history[0][0] != "v1.124.59":
    history.insert(0, ["v1.124.59", "Canonicalize Club view links across switching and refresh"])
history_path.write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")

print("Applied strict Club routing and stable Club title patch.")
