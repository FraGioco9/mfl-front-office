async function copyPlayerId(id) {
  try {
    await navigator.clipboard.writeText(String(id));
    const content = document.createElement("span");
    content.className = "toastPlayerIdContent";
    content.textContent = `Player ID ${id} copied.`;
    showToast(content);
  } catch {
    showToast("Could not copy player ID.");
  }
}
function renderPlayerPage(playerId) {
  const owner = window.__mflRenderPlayerPageOwner;
  if (typeof owner !== "function") {
    throw new Error("Player route core is not loaded.");
  }
  return owner(playerId);
}