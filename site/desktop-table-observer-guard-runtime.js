(() => {
  "use strict";

  const NativeObserver = window.MutationObserver;
  if (!NativeObserver || window.__mflTableObserverGuardInstalled) return;
  window.__mflTableObserverGuardInstalled = true;

  window.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      let guardRows = false;
      super((records, observer) => {
        const filtered = guardRows
          ? records.filter((record) => {
              const target = record.target;
              return !(record.type === "childList"
                && target instanceof Element
                && (target.id === "tableBody" || target.closest("#tableBody")));
            })
          : records;
        if (filtered.length) callback(filtered, observer);
      });
      this.enableProgressionRowGuard = () => { guardRows = true; };
    }

    observe(target, options) {
      if (target instanceof Element
        && target.id === "progressionPage"
        && options?.childList === true
        && options?.subtree === true) {
        this.enableProgressionRowGuard();
      }
      return super.observe(target, options);
    }
  };

  window.__mflRestoreNativeMutationObserver = () => {
    window.MutationObserver = NativeObserver;
  };
})();
