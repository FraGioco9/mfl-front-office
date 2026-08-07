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
 * @typedef {{ name: string, marker: string | null }} ClassicSourcePartition
 */

/**
 * Split one classic-script source at ordered top-level markers.
 * @param {string} source
 * @param {readonly ClassicSourcePartition[]} partitions
 * @returns {Array<{ name: string, source: string }>}
 */
export function splitClassicSource(source, partitions) {
  if (!Array.isArray(partitions) || !partitions.length || partitions[0].marker !== null) {
    throw new Error("Classic runtime partitions must start with a markerless foundation section.");
  }

  const offsets = [0];
  let cursor = 0;

  for (let index = 1; index < partitions.length; index += 1) {
    const marker = String(partitions[index].marker || "");
    if (!marker) {
      throw new Error(`Classic runtime partition ${partitions[index].name} is missing a marker.`);
    }

    const offset = source.indexOf(marker, cursor);
    if (offset < 0) {
      throw new Error(`Could not locate classic runtime partition ${partitions[index].name}.`);
    }
    if (offset <= cursor) {
      throw new Error(`Classic runtime partition ${partitions[index].name} is out of order.`);
    }

    offsets.push(offset);
    cursor = offset + marker.length;
  }

  return partitions.map((partition, index) => ({
    name: partition.name,
    source: source.slice(offsets[index], offsets[index + 1] ?? source.length),
  }));
}

/**
 * Execute source as a classic script while retaining a useful runtime name for
 * DevTools and error reporting.
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
 * Fetch the retained classic source once, prepare it, then execute named
 * top-level partitions in the original order.
 * @param {string} path
 * @param {string} version
 * @param {readonly ClassicSourcePartition[]} partitions
 * @param {(source: string) => string} [prepareSource]
 */
export async function loadPartitionedClassicScript(path, version, partitions, prepareSource = (source) => source) {
  const response = await fetch(versionedAssetUrl(path, version), {
    headers: { Accept: "application/javascript" },
  });
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status}).`);
  }

  const source = prepareSource(await response.text());
  const sections = splitClassicSource(source, partitions);
  for (const section of sections) {
    executeClassicSource(section.source, `core-${section.name}`);
  }
}
