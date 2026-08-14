interface Window {
  __mflApiFetchPolicyInstalled?: boolean;
  __mflReleaseVersion?: string;
  __mflRelease?: Readonly<{ version: string; description: string }>;
  __mflAssetUrl?: (path: string) => string;
  __mflPopupCenteringResizeObserver?: ResizeObserver;
  __mflStaticUiRuntime?: { destroy?: () => void };
  __mflFilterControlsRuntime?: { sync?: () => void };
  __mflEvaluationDiscountRateDisplayRuntime?: { sync?: () => void; destroy?: () => void };
  __mflSelectionStartupResetRuntime?: { rebind?: () => void; destroy?: () => void };
  __mflDatabaseStatsRuntime?: { sync?: () => void };
}

interface ParentNode {
  querySelectorAll(selectors: ".mflStatsFilterButton"): NodeListOf<HTMLElement>;
}
