(() => {
  "use strict";

  if (window.__mflCoreResponseCacheInstalled) return;
  window.__mflCoreResponseCacheInstalled = true;

  const CORE_PATH = "/modules/app-core.js";
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "").trim();
  const CACHE_KEY = RELEASE_VERSION ? `mfl-core-response:${RELEASE_VERSION}` : "";
  const originalFetch = window.fetch.bind(window);
  let intercepted = false;

  function coreRequest(input) {
    try {
      const raw = input instanceof Request ? input.url : String(input);
      const url = new URL(raw, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== CORE_PATH) return false;
      const method = input instanceof Request ? input.method : "GET";
      return String(method || "GET").toUpperCase() === "GET";
    } catch {
      return false;
    }
  }

  function cachedSource() {
    if (!CACHE_KEY) return "";
    try {
      return sessionStorage.getItem(CACHE_KEY) || "";
    } catch {
      return "";
    }
  }

  function storeSource(source) {
    if (!CACHE_KEY || !source) return;
    try {
      sessionStorage.setItem(CACHE_KEY, source);
    } catch {}
  }

  function responseFromSource(source) {
    return new Response(source, {
      status: 200,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "X-MFL-Core-Cache": "session",
      },
    });
  }

  function wrapCoreFetch(upstreamFetch) {
    return async (input, init = {}) => {
      if (!coreRequest(input)) return upstreamFetch(input, init);

      const cached = cachedSource();
      if (cached) return responseFromSource(cached);

      const response = await upstreamFetch(input, init);
      if (response.ok) {
        void response.clone().text().then(storeSource).catch(() => {});
      }
      return response;
    };
  }

  /* bootstrap-core is the first runtime that replaces window.fetch. Intercept
   * exactly that assignment, then restore a normal writable fetch property so
   * app-entry can later install its API request policy without recursion. */
  Object.defineProperty(window, "fetch", {
    configurable: true,
    enumerable: true,
    get() {
      return originalFetch;
    },
    set(nextFetch) {
      if (intercepted || typeof nextFetch !== "function") {
        Object.defineProperty(window, "fetch", {
          configurable: true,
          enumerable: true,
          writable: true,
          value: nextFetch,
        });
        return;
      }

      intercepted = true;
      const upstreamFetch = nextFetch.bind(window);
      Object.defineProperty(window, "fetch", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: wrapCoreFetch(upstreamFetch),
      });
    },
  });
})();
