const App = (() => {
  const $ = (id) => document.getElementById(id);
  let pendingLeavePlace = null;

  const init = async () => {
    try {
      await Data.init();
    } catch (e) {
      const banner = $("setup-banner");
      banner.hidden = false;
      banner.innerHTML = `⚠️ ${e.message}`;
      show("home");
      Home.init();
      return;
    }
    UI.bindModalClosers();
    UI.setAuthLabel();
    bindAuth();
    bindActions();
    await Explore.init();

    await loadAll();
    show("home");
    Home.init();
  };

  // --------- router ---------
  const views = () => Array.from(document.querySelectorAll("[data-view]"));

  const show = (view) => {
    views().forEach((v) => {
      v.hidden = v.dataset.view !== view;
      if (v.hidden) v.style.display = "";
      else v.style.display = "block";
    });
    document.querySelectorAll(".nav-item").forEach((n) => {
      n.classList.toggle("active", n.dataset.view === view);
    });
    if (view === "explore") Explore.resize();
    if (view === "traces") Traces.refresh();
  };

  // --------- data ---------
  const loadAll = async () => {
    try {
      await Data.loadProfiles();
      const [places, memories] = await Promise.all([Data.listPlaces(), Data.listMemories()]);
      Explore.setPlaces(places, memories);
    } catch (e) {
      const toast = document.getElementById("toast");
      if (!toast.classList.contains("loading")) UI.showToast(e.message, true);
    }
  };

  const openPlace = (place) => Place.show(place);

  const startLeave = (preset) => {
    if (!Data.currentUser()) {
      pendingLeavePlace = preset || null;
      openAuthModal();
      return;
    }
    Leave.open(preset);
  };

  // --------- auth ---------
  const openAuthModal = () => {
    $("auth-view-form").hidden = false;
    $("auth-view-verify").hidden = true;
    $("auth-title").textContent = "Sign in";
    $("auth-sub").textContent = "Traces need an author. Sign in to leave yours.";
    $("auth-submit").textContent = "Sign in";
    $("auth-toggle").textContent = "New here? Create an account";
    $("pw-confirm-field").hidden = true;
    $("auth-confirm").required = false;
    $("auth-confirm").value = "";
    $("auth-form").reset();
    $("auth-err").hidden = true;
    UI.openModal("modal-auth");
  };

  const bindAuth = () => {
    const formView = $("auth-view-form");
    const verifyView = $("auth-view-verify");
    const isSignupMode = () => $("auth-title").textContent === "Create account";

    const setSignupFieldVisibility = (signup) => {
      const field = $("pw-confirm-field");
      if (signup) {
        field.hidden = false;
        $("auth-confirm").required = true;
        $("auth-confirm").setAttribute("autocomplete", "new-password");
      } else {
        field.hidden = true;
        $("auth-confirm").required = false;
        $("auth-confirm").value = "";
      }
    };

    const showForm = () => {
      formView.hidden = false;
      verifyView.hidden = true;
    };
    const showVerify = (email) => {
      $("verify-email").textContent = email;
      formView.hidden = true;
      verifyView.hidden = false;
      hint("Sent. Check your inbox and confirm the link.");
    };
    const hint = (msg) => {
      const el = $("verify-hint");
      el.textContent = msg;
    };

    $("pw-toggle").addEventListener("click", () => {
      const input = $("auth-password");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      $("pw-toggle").textContent = show ? "🙈" : "👁";
    });

    $("pw-confirm-toggle").addEventListener("click", () => {
      const input = $("auth-confirm");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      $("pw-confirm-toggle").textContent = show ? "🙈" : "👁";
    });

    $("auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = $("auth-username").value.trim();
      const password = $("auth-password").value;
      const err = $("auth-err");
      err.hidden = true;
      const submitBtn = $("auth-submit");
      try {
        if (isSignupMode()) {
          if (password.length < 4) throw new Error("Password must be at least 4 characters");
          if (password !== $("auth-confirm").value) throw new Error("Passwords don't match");
          submitBtn.disabled = true;
          submitBtn.textContent = "Creating account…";
          const user = await Data.register(username, password);
          if (user.needsConfirmation) {
            showVerify(user.username);
            return;
          }
          UI.showToast(`Welcome, ${username} ✦ the future is yours`);
        } else {
          submitBtn.disabled = true;
          submitBtn.textContent = "Signing in…";
          await Data.login(username, password);
          UI.showToast("Welcome back");
        }
        resetAuthModal();
        UI.setAuthLabel();
        loadAll();
        if (pendingLeavePlace) {
          const preset = pendingLeavePlace;
          pendingLeavePlace = null;
          Leave.open(preset);
        }
      } catch (e2) {
        err.textContent = e2.message;
        err.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isSignupMode() ? "Create account" : "Sign in";
      }
    });

    const resetAuthModal = () => {
      UI.closeModal("modal-auth");
      $("auth-form").reset();
      setSignupFieldVisibility(false);
      $("auth-title").textContent = "Sign in";
      $("auth-sub").textContent = "Traces need an author. Sign in to leave yours.";
      $("auth-submit").textContent = "Sign in";
      $("auth-toggle").textContent = "New here? Create an account";
      showForm();
    };

    $("verify-done").addEventListener("click", async () => {
      try {
        await Data.completeSignup();
        UI.showToast("You're in. Leave a trace — the future is listening.");
        resetAuthModal();
        UI.setAuthLabel();
        loadAll();
      } catch (e) {
        hint(e.message);
      }
    });

    $("verify-resend").addEventListener("click", async () => {
      try {
        await Data.resendConfirmation();
        hint("Link sent again — check your inbox.");
      } catch (e) {
        hint(e.message);
      }
    });

    $("verify-back").addEventListener("click", resetAuthModal);

    $("auth-toggle").addEventListener("click", () => {
      const isSignup = isSignupMode();
      setSignupFieldVisibility(!isSignup);
      $("auth-title").textContent = isSignup ? "Sign in" : "Create account";
      $("auth-sub").textContent = isSignup ? "Traces need an author. Sign in to leave yours." : "Join to leave your first trace.";
      $("auth-submit").textContent = isSignup ? "Sign in" : "Create account";
      $("auth-toggle").textContent = isSignup ? "New here? Create an account" : "Already have an account? Sign in";
      $("auth-err").hidden = true;
    });
  };

  // --------- nav / actions ---------
  const bindActions = () => {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => show(btn.dataset.view));
    });
    $("brand").addEventListener("click", () => show("home"));
    $("locate-btn").addEventListener("click", () => Explore.locateMe());
    $("place-back").addEventListener("click", () => show("explore"));
    $("pick-cancel").addEventListener("click", () => Explore.setPickMode(false));
    $("auth-btn").addEventListener("click", () => {
      const user = Data.currentUser();
      if (user) {
        Data.logout();
        UI.setAuthLabel();
        UI.showToast("Signed out");
        loadAll();
        show("home");
      } else {
        openAuthModal();
      }
    });
  };

  return { init, show, openPlace, startLeave, openAuthModal, loadAll };
})();

document.addEventListener("DOMContentLoaded", () => App.init());