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
        UI.openModal("modal-auth");
      }
    });
  };

  const bindAuth = () => {
    $("auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = $("auth-username").value.trim();
      const password = $("auth-password").value;
      const err = $("auth-err");
      err.hidden = true;
      const isSignup = $("auth-title").textContent === "Create account";
      try {
        if (isSignup) {
          if (password.length < 4) throw new Error("Password must be at least 4 characters");
          await Data.register(username, password);
          UI.showToast(`Welcome, ${username} ✦ the future is yours`);
        } else {
          await Data.login(username, password);
          UI.showToast("Welcome back, time traveler");
        }
        UI.closeModal("modal-auth");
        $("auth-form").reset();
        $("auth-title").textContent = "Sign in";
        $("auth-sub").textContent = "Bottles need an author. Sign in to drop yours.";
        $("auth-submit").textContent = "Sign in";
        $("auth-toggle").textContent = "New here? Create an account";
        UI.setAuthLabel();
        refreshEverything();
      } catch (e2) {
        err.textContent = e2.message;
        err.hidden = false;
      }
    });

    $("auth-toggle").addEventListener("click", () => {
      const isSignup = $("auth-title").textContent === "Sign in";
      $("auth-title").textContent = isSignup ? "Create account" : "Sign in";
      $("auth-sub").textContent = isSignup ? "Join to drop your first bottle." : "Bottles need an author. Sign in to drop yours.";
      $("auth-submit").textContent = isSignup ? "Create account" : "Sign in";
      $("auth-toggle").textContent = isSignup ? "Already have an account? Sign in" : "New here? Create an account";
    });
  };

  const refreshCapsules = async () => {
    try {
      const caps = await Data.listCapsules();
      await Explore.refreshCapsules(caps);
    } catch (e) {
      UI.showToast(e.message, true);
    }
  };

  const refreshEverything = async () => {
    await refreshCapsules();
  };

  return { init, refreshCapsules, refreshEverything };
})();

document.addEventListener("DOMContentLoaded", () => App.init());