const UI = (() => {
  let toastTimer = null;

  const showToast = (message, isError = false, sticky = false) => {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.toggle("err", isError);
    el.classList.toggle("loading", sticky);
    el.hidden = false;
    clearTimeout(toastTimer);
    if (!sticky) {
      toastTimer = setTimeout(() => (el.hidden = true), 3800);
    }
  };

  const hideToast = () => {
    clearTimeout(toastTimer);
    const el = document.getElementById("toast");
    if (el) {
      el.classList.remove("loading");
      el.hidden = true;
    }
  };

  const openModal = (id) => {
    const el = document.getElementById(id);
    el.hidden = false;
  };

  const closeModal = (id) => {
    const el = document.getElementById(id);
    el.hidden = true;
  };

  const setAuthLabel = () => {
    const user = Data.currentUser();
    const label = document.getElementById("auth-label");
    const btn = document.getElementById("auth-btn");
    if (user) {
      label.textContent = "✦ " + user.username;
      label.hidden = false;
      btn.textContent = "Sign out";
    } else {
      label.hidden = true;
      btn.textContent = "Sign in";
    }
  };

  const bindModalClosers = () => {
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll(".modal").forEach((m) => {
      m.addEventListener("click", (e) => {
        if (e.target === m) m.hidden = true;
      });
    });
  };

  return {
    showToast,
    hideToast,
    openModal,
    closeModal,
    setAuthLabel,
    bindModalClosers
  };
})();