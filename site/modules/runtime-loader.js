// @ts-check

/**
 * @param {string} path
 * @param {string} version
 */
export function versionedAssetUrl(path, version) {
  const url = new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`);
  url.searchParams.set("v", version);
  return url.href;
}

/**
 * Load a classic script in a deterministic order.
 * @param {string} path
 * @param {string} version
 * @returns {Promise<void>}
 */
export function loadClassicScript(path, version) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = versionedAssetUrl(path, version);
    script.async = false;
    script.dataset.mflRuntime = path;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Could not load ${path}.`)), { once: true });
    document.head.appendChild(script);
  });
}

/**
 * @param {readonly string[]} paths
 * @param {string} version
 */
export async function loadScriptGroup(paths, version) {
  for (const path of paths) {
    await loadClassicScript(path, version);
  }
}

/**
 * Execute source as one classic script. Keeping the full prepared core in a
 * single script preserves whole-script declaration hoisting and initialization
 * order from the original runtime.
 * @param {string} source
 * @param {string} runtimeName
 */
export function executeClassicSource(source, runtimeName) {
  const sourceUrl = `mfl-runtime-${String(runtimeName || "core").replace(/[^a-z0-9_-]+/gi, "-")}.js`;
  /** @type {Error | null} */
  let executionError = null;
  /** @param {ErrorEvent} event */
  const onError = (event) => {
    const filename = String(event.filename || "");
    if (!filename || filename.endsWith(sourceUrl)) {
      executionError = event.error instanceof Error ? event.error : new Error(event.message || `Could not execute ${runtimeName}.`);
    }
  };

  window.addEventListener("error", onError);
  try {
    const script = document.createElement("script");
    script.async = false;
    script.dataset.mflRuntime = runtimeName;
    script.textContent = `${source}\n//# sourceURL=${sourceUrl}`;
    document.head.appendChild(script);
    if (executionError) throw executionError;
  } finally {
    window.removeEventListener("error", onError);
  }
}

/**
 * Fetch and prepare a classic script, then execute it as one source unit.
 * @param {string} path
 * @param {string} version
 * @param {(source: string) => string} [prepareSource]
 */
export async function loadPreparedClassicScript(path, version, prepareSource = (source) => source) {
  const response = await fetch(versionedAssetUrl(path, version), {
    headers: { Accept: "application/javascript" },
  });
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status}).`);
  }

  const source = prepareSource(await response.text());
  executeClassicSource(source, "core");
}
