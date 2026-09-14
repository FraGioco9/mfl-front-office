interface MflDataClient {
  fetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    options?: { dedupe?: boolean; cacheTtlMs?: number; key?: string },
  ): Promise<Response>;
  clearCache(): void;
  snapshot(): Readonly<{ inFlight: number; cached: number }>;
}

interface Window {
  __mflReleaseVersion?: string;
  __mflRelease?: Readonly<{ version: string; description: string }>;
  __mflAssetUrl?: (path: string) => string;
  __mflPopupCenteringResizeObserver?: ResizeObserver;
  __mflStaticUiRuntime?: { destroy?: () => void };
  __mflFilterControlsRuntime?: { sync?: () => void };
  __mflSelectionStartupResetRuntime?: { rebind?: () => void; destroy?: () => void };
  __mflDatabaseStatsRuntime?: { sync?: () => void };
  __mflDataClient?: MflDataClient;
}

interface ParentNode {
  querySelectorAll(selectors: ".mflStatsFilterButton"): NodeListOf<HTMLElement>;
}
