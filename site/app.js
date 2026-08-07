(() => {
  "use strict";

  const currentScript = document.currentScript;
  const scriptUrl = currentScript?.src ? new URL(currentScript.src, window.location.href) : null;
  const version = scriptUrl?.searchParams.get("v") || String(Date.now());
  const entryUrl = new URL("./modules/app-entry.js", window.location.href);
  entryUrl.searchParams.set("v", version);

  import(entryUrl.href).catch((error) => {
    console.error("Could not import the MFL Front Office entry module.", error);
  });
})();
