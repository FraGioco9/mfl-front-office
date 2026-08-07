(() => {
  "use strict";

  void (async () => {
    let version = String(Date.now());

    try {
      const response = await fetch("/release.json", { cache: "no-store" });
      if (response.ok) {
        const release = await response.json();
        if (release?.version) version = String(release.version);
      }
    } catch {
      // The timestamp fallback still guarantees a fresh entry-module request.
    }

    const entryUrl = new URL("./modules/app-entry.js", window.location.href);
    entryUrl.searchParams.set("v", version);

    try {
      await import(entryUrl.href);
    } catch (error) {
      console.error("Could not import the MFL Front Office entry module.", error);
    }
  })();
})();
