const App = (() => {
  const $ = (id) => document.getElementById(id);

  const init = async () => {
    try {
      await Data.init();
    } catch (e) {
      const banner = $("setup-banner");
      banner.hidden = false;
      banner.innerHTML = `⚠️ ${e.message}`;
      return;
    }
    bindAuth();
    UI.bindModalClosers();
    UI.setAuthLabel();

    await Explore.init();
    await refreshCapsules();
    Deposit.renderForm();
    bindActions();
  };

  const bindActions = () => {
    $("deposit-open").addEventListener("click", () => Deposit.showPanel());
    $("deposit-close").addEventListener("click", () => Deposit.hidePanel());
    $("locate-btn").addEventListener("click", () => Explore.locateMe());
    $("auth-btn").addEventListener("click", () => {
      const user = Data.currentUser();
      if (user) {
        Data.logout();
        UI.setAuthLabel();
        UI.showToast("Signed out");
        refreshEverything();
      } else {
        App.openAuthModal();
      }
    });
  };

  const openAuthModal = () => {
    UI.closeModal("modal-auth");
    // reset to sign-in state so the confirm-password field never leaks into login
    const formView = $("auth-view-form");
    const verifyView = $("auth-view-verify");
    formView.hidden = false;
    verifyView.hidden = true;
    $("auth-title").textContent = "Sign in";
    $("auth-sub").textContent = "Bottles need an author. Sign in to drop yours.";
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
          UI.showToast("Welcome back, time traveler");
        }
        resetAuthModal();
        UI.setAuthLabel();
        refreshEverything();
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
      $("auth-sub").textContent = "Bottles need an author. Sign in to drop yours.";
      $("auth-submit").textContent = "Sign in";
      $("auth-toggle").textContent = "New here? Create an account";
      showForm();
    };

    $("verify-done").addEventListener("click", async () => {
      try {
        await Data.completeSignup();
        UI.showToast("You're in. Drop a bottle — the future is listening.");
        resetAuthModal();
        UI.setAuthLabel();
        refreshEverything();
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
      $("auth-sub").textContent = isSignup ? "Bottles need an author. Sign in to drop yours." : "Join to drop your first bottle.";
      $("auth-submit").textContent = isSignup ? "Sign in" : "Create account";
      $("auth-toggle").textContent = isSignup ? "New here? Create an account" : "Already have an account? Sign in";
      $("auth-err").hidden = true;
    });
  };

  const refreshCapsules = async () => {
    try {
      const caps = await Data.listCapsules();
      await Explore.refreshCapsules(caps);
    } catch (e) {
      const toast = document.getElementById("toast");
      // don't clobber an active sticky toast (e.g. "Finding your location…")
      if (toast && !toast.classList.contains("loading")) {
        UI.showToast(e.message, true);
      }
    }
  };

  const refreshEverything = async () => {
    await refreshCapsules();
  };

  return { init, refreshCapsules, refreshEverything, openAuthModal };
})();

document.addEventListener("DOMContentLoaded", () => App.init());