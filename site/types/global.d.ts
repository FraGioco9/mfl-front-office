interface Window {
  __mflApiFetchPolicyInstalled?: boolean;
  __mflReleaseVersion?: string;
  __mflRelease?: Readonly<{ version: string; description: string }>;
  __mflAssetUrl?: (path: string) => string;
  __mflReleaseUiRuntime?: { destroy?: () => void };
  __mflDatabaseStatsRuntime?: { sync?: () => void };
}

interface ParentNode {
  querySelectorAll(selectors: ".mflStatsFilterButton"): NodeListOf<HTMLElement>;
}
