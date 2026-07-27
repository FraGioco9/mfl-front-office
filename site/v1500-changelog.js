(() => {
  function addVersion1500ChangelogEntry() {
    const list = document.querySelector(".changelogList");
    if (!list || list.querySelector('[data-version="1.150.0"]')) return;

    const item = document.createElement("li");
    item.dataset.version = "1.150.0";

    const version = document.createElement("span");
    version.textContent = "v1.150.0";

    const description = document.createElement("p");
    description.textContent = "Add club pages, club search, club routing, division labels, and position-sorted club squads";

    item.append(version, description);
    list.prepend(item);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addVersion1500ChangelogEntry, { once: true });
  } else {
    addVersion1500ChangelogEntry();
  }
})();