interface MflDataClient {
  fetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    options?: { dedupe?: boolean; cacheTtlMs?: number; key?: string },
  ): Promise<Response>;
  clearCache(): void;
  snapshot(): Readonly<{ inFlight: number; cached: number }>;
}

interface MflFlowWalletModule {
  config(values?: Record<string, unknown>): unknown;
}

interface MflClubRoute {
  clubId: string;
  view: string;
  path: string;
}

interface MflCanonicalRouteRequest {
  pageName: string;
  options: Record<string, unknown>;
  canonicalPath: string;
}

interface MflTableViewRouteConfig {
  order: readonly string[];
  fallback: string;
}

interface MflRouteDependencyPlan {
  pageName: string;
  view: string;
  core: readonly string[];
  preCore: readonly string[];
  postCore: readonly string[];
  runtimeKey: string;
  table: boolean;
  watchlist: boolean;
  databaseStats: boolean;
  stats: boolean;
}

interface MflAppRouteConfig {
  clubRoute(pathname?: string): MflClubRoute | null;
  clubPath(clubId: string, view?: string): string;
  canonicalRequest(pathname?: string): MflCanonicalRouteRequest;
  initialRequest(pathname?: string): MflCanonicalRouteRequest;
  normalizePageName(pageName: unknown): string;
  routeDependencyPlan(pageName: unknown, options?: Record<string, unknown>): MflRouteDependencyPlan;
  requestShellId(request: unknown, options?: Record<string, unknown>): string;
  usesTableInfrastructure(pageName: unknown): boolean;
  tableViews: Readonly<Record<string, MflTableViewRouteConfig>>;
  mflWalletAddress: string;
}

interface MflAppTableConfig {
  baseColumns: readonly string[];
  statColumns: readonly string[];
  contractColumns: readonly string[];
  viewColumns: Readonly<Record<string, readonly string[]>>;
  joinedAgencyPages: readonly string[];
  sortableColumns: readonly string[];
  columnLabels: Readonly<Record<string, string>>;
  columnClasses: Readonly<Record<string, string>>;
  displayColumn?(page: string, column: string): string;
  columnsFor?(page: string, view: string): string[];
  columnClass?(column: string): string;
}

interface MflStatsOverallFilter {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
}

interface MflFormatOption {
  value: string;
  label: string;
}

interface MflAppUiConfig {
  mflStatsOverallFilters: readonly MflStatsOverallFilter[];
  settingsDateFormats: readonly MflFormatOption[];
  settingsTimeFormats: readonly MflFormatOption[];
}

interface MflAppConfig {
  release: Readonly<{ version: string; description: string }>;
  routes: MflAppRouteConfig;
  table: MflAppTableConfig;
  ui: MflAppUiConfig;
}

interface MflStaticUiRuntime {
  sync?: () => unknown;
  syncTableViews?: (page: string, view: string) => void;
  showNotFound?: (kind?: string) => unknown;
  destroy?: () => void;
  hideTooltips?: (options?: { immediate?: boolean; restore?: boolean }) => void;
}

interface MflSharedTableUiRuntime {
  sync?: () => unknown;
  syncRouteHorizontalStructureNow?: () => unknown;
  syncRouteHorizontalCuesNow?: () => unknown;
  destroy?: () => void;
}

interface MflTableLoadingRuntime {
  beginRequest?: (routeScope?: string, options?: { loadingMode?: unknown }) => number;
  finishRequest?: (token?: number) => boolean;
  requestActive?: () => boolean;
  syncRenderedRows?: () => boolean;
  show?: (options?: { replaceExisting?: boolean; forceRoute?: boolean }) => boolean;
  release?: () => boolean | void;
  sync?: () => boolean | void;
  installCoreBridge?: () => boolean;
  destroy?: () => void;
}

interface MflPlayerFirstPaintContext extends Record<string, unknown> {
  playerId?: unknown;
}

interface MflPlayerFirstPaintRuntime {
  beginDetailNavigation?: (context: unknown) => boolean;
  renderPending?: (context?: unknown) => boolean;
  markDetailPayloadReady?: (route: unknown, payload: unknown) => boolean;
  detailDataReady?: (row: unknown, playerId: unknown) => boolean;
  stableAttributePanelHtml?: (row: unknown) => string;
  hydrateHero?: (value?: unknown) => boolean;
  snapshotRowKnownValues?: (row: unknown) => object;
  bindHeroActionMenu?: (container?: ParentNode) => boolean;
  animateReadyControls?: (container?: ParentNode) => boolean;
  attributeViewForRender?: (selectedView: string, playerId?: unknown) => string;
  attributeViewLoadingActive?: (playerId?: unknown) => boolean;
  syncAttributeViewActiveState?: (containerValue?: unknown, playerIdValue?: unknown) => unknown;
  playerAgeMarkerHtml?: (value: unknown) => string;
  playerNationalityHtml?: (rawValue: unknown, displayValue?: unknown) => string;
  heroBrandingSignature?: (playerId: unknown) => string;
}

interface MflSavedEvaluationPayload extends Record<string, unknown> {
  playerId?: unknown;
}

interface MflSavedEvaluationCacheEntry extends Record<string, unknown> {
  id?: unknown;
  playerId?: unknown;
  playerName?: unknown;
  presentValue?: unknown;
  payload?: MflSavedEvaluationPayload;
}

interface MflEvaluationSearchStateRuntime {
  sync?: () => void;
  restoreEmptyRecentResults?: (force?: boolean, stateOnly?: boolean) => Promise<boolean>;
  selectEmptySearch?: () => unknown;
  shouldShowTypedResults?: () => boolean;
  ownsEmptyRecentResults?: () => boolean;
  destroy?: () => void;
}

interface Window {
  __mflReleaseVersion?: string;
  __mflRelease?: Readonly<{ version: string; description: string }>;
  __mflAssetUrl?: (path: string) => string;
  __mflPopupCenteringResizeObserver?: ResizeObserver;
  __mflStaticUiRuntime?: MflStaticUiRuntime;
  __mflFilterControlsRuntime?: { sync?: () => void };
  __mflSelectionStartupResetRuntime?: { rebind?: () => void; destroy?: () => void };
  __mflDatabaseStatsRuntime?: { sync?: () => void };
  __mflDataClient?: MflDataClient;
  __mflAppConfig: MflAppConfig;
  __mflTableLoadingRuntime?: MflTableLoadingRuntime;
  __mflSharedTableUiRuntime?: MflSharedTableUiRuntime;
  __mflPlayerFirstPaintRuntime?: MflPlayerFirstPaintRuntime;
  __mflGlobalSearchReadyPromise?: Promise<boolean>;
  __mflRestoringSavedEvaluation?: boolean;
  __mflSavedEvaluationsSessionCacheWallet?: string;
  __mflSavedEvaluationsSessionCache?: MflSavedEvaluationCacheEntry[] | null;
  __mflSavedEvaluationPayloadCache?: Record<string, MflSavedEvaluationCacheEntry>;
  __mflEvaluationSearchStateRuntime?: MflEvaluationSearchStateRuntime;
  __mflTooltipHeight?: number;
  __mflCancelIncrementalRouteRequest?: () => number;
  __mflBuildPlayerFirstPaintContext?: (playerId: unknown) => MflPlayerFirstPaintContext;
  __mflPlayerFirstPaintPendingContext?: MflPlayerFirstPaintContext | null;
  mflLoadIncrementalRoutePage?: (pageName: string, options?: Record<string, unknown>) => Promise<boolean>;
  mflReloadIncrementalPage?: (page?: number, options?: Record<string, unknown>) => Promise<boolean>;
  __mflOpenClubPageRoute?: (clubId: string, view?: string) => unknown;
  mflOpenClubPage?: ((clubId: string, view?: string) => unknown) & { __mflRouteRuntimeGate?: boolean };
  __mflRenderPlayerPageOwner?: (playerId?: unknown) => unknown;
  onflowFcl?: MflFlowWalletModule;
  fcl?: MflFlowWalletModule;
}

interface ParentNode {
  querySelector(selectors: ".playerNoteFloatingTooltip"): HTMLElement | null;
  querySelector(selectors: "#playerEvaluateButton" | "#copyPlayerIdButton"): HTMLButtonElement | null;
  querySelector(selectors: ".playerAgentLink"): HTMLElement | null;
  querySelector(selectors: "#playerNotesInput"): HTMLTextAreaElement | null;
  querySelector(selectors: "#progressionPage .quickFilters" | "#progressionPage .controlsBar"): HTMLElement | null;
  querySelector(selectors: "[data-filter-operator]" | "[data-filter-connector]" | "[data-filter-column-select]"): HTMLSelectElement | null;
  querySelector(selectors: "[data-filter-value]"): HTMLInputElement | HTMLSelectElement | null;
  querySelector(selectors: "#selectVisiblePlayersInput"): HTMLInputElement | null;
  querySelectorAll(selectors: "[data-evaluation-summary-position]"): NodeListOf<HTMLSelectElement>;
  querySelectorAll(
    selectors: ".mflStatsFilterButton" | "[data-player-attribute-view]" | "[data-training-stat]" | "[data-training-reset]" | ".filterRule" | "#progressionPage .pager, #progressionPage nav.pager",
  ): NodeListOf<HTMLElement>;
  querySelectorAll(selectors: "[data-filter-value]"): NodeListOf<HTMLInputElement | HTMLSelectElement>;
}

interface Document {
  getElementById(elementId: "pagerCurrentPageInput"): HTMLInputElement | null;
  getElementById(elementId: "pagerTotalPages"): HTMLElement | null;
}
