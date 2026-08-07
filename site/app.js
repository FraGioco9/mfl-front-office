(() => {
  "use strict";

  import("./modules/app-entry.js").catch((error) => {
    console.error("Could not import the MFL Front Office entry module.", error);
  });
})();
