function showModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("modalClosing", "modalOpen");
  modal.hidden = false;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      modal.classList.add("modalOpen");
    });
  });
}

function hideModal(modal, afterClose) {
  if (!modal || modal.hidden) {
    if (typeof afterClose === "function") {
      afterClose();
    }
    return;
  }

  modal.classList.remove("modalOpen");
  modal.classList.add("modalClosing");
  window.setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove("modalClosing");
    if (typeof afterClose === "function") {
      afterClose();
    }
  }, 180);
}

function setupBackdropClickClose(modal, closeCallback) {
  if (!modal || typeof closeCallback !== "function") {
    return;
  }

  let pointerStartedOnBackdrop = false;

  modal.addEventListener("pointerdown", (event) => {
    pointerStartedOnBackdrop = event.target === modal;
  });

  modal.addEventListener("click", (event) => {
    if (pointerStartedOnBackdrop && event.target === modal) {
      closeCallback();
    }

    pointerStartedOnBackdrop = false;
  });
}