function scheduleToastHide(toast) {
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}

function hideToast() {
  const toast = document.querySelector("#toastMessage");
  if (!toast) {
    return;
  }

  window.clearTimeout(state.toastTimer);
  toast.classList.remove("visible");
}

// Stable status/alert nodes, kept outside route shells and dialogs so hidden
// destinations or a closing modal cannot swallow operation feedback.
let lastActionAnnouncementText = "";
let lastActionAnnouncementUrgent = false;
let lastActionAnnouncementAt = 0;
let actionAnnouncementSequence = 0;

function actionAnnouncementRegion(urgent = false) {
  const id = urgent ? "mflActionAlert" : "mflActionStatus";
  let node = document.getElementById(id);
  if (node instanceof HTMLElement) return { node, fresh: false };
  node = document.createElement("p");
  node.id = id;
  node.className = "mflA11yStatus";
  node.setAttribute("role", urgent ? "alert" : "status");
  node.setAttribute("aria-live", urgent ? "assertive" : "polite");
  node.setAttribute("aria-atomic", "true");
  document.body.appendChild(node);
  return { node, fresh: true };
}

function announceActionStatus(message, options = {}) {
  const value = String(message || "").replace(/\\s+/g, " ").trim();
  if (!value) return false;
  const urgent = options.urgent === true;
  const now = Date.now();
  if (options.force !== true
    && value === lastActionAnnouncementText
    && urgent === lastActionAnnouncementUrgent
    && now - lastActionAnnouncementAt < 1800) return false;

  lastActionAnnouncementText = value;
  lastActionAnnouncementUrgent = urgent;
  lastActionAnnouncementAt = now;
  const { node, fresh } = actionAnnouncementRegion(urgent);
  const other = document.getElementById(urgent ? "mflActionStatus" : "mflActionAlert");
  if (other instanceof HTMLElement) other.textContent = "";
  const sequence = ++actionAnnouncementSequence;
  const commit = () => {
    if (sequence !== actionAnnouncementSequence || !node.isConnected) return;
    node.textContent = value;
  };
  // A newly inserted live region must exist in the accessibility tree before
  // its first update; subsequent messages update the same stable DOM node.
  if (fresh && typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(commit);
  else commit();
  return true;
}

function showToast(message, options = {}) {
  let toast = document.querySelector("#toastMessage");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastMessage";
    toast.className = "toastMessage";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "off");
    toast.setAttribute("aria-hidden", "true");
    toast.addEventListener("mouseenter", () => window.clearTimeout(state.toastTimer));
    toast.addEventListener("mouseleave", () => {
      if (toast.getAttribute("data-sticky") !== "true") scheduleToastHide(toast);
    });
    document.body.appendChild(toast);
  }

  toast.replaceChildren();
  if (message instanceof Node) {
    toast.appendChild(message);
  } else {
    toast.textContent = message;
  }
  toast.setAttribute("data-sticky", options.sticky === true ? "true" : "false");
  toast.classList.add("visible");
  announceActionStatus(toast.textContent, { urgent: options.urgent === true });
  if (options.sticky) {
    window.clearTimeout(state.toastTimer);
  } else {
    scheduleToastHide(toast);
  }
}
