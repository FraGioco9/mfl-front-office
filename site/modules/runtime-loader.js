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
