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

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

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

  const capsuleState = (capsule, user) => {
    const now = Date.now();
    const opened = new Date(capsule.unlock_at).getTime() <= now;
    const isMine = user && capsule.author_id === user.id;
    return { opened, isMine };
  };

  const renderCapsuleView = (capsule, location, authorName) => {
    const user = Data.currentUser();
    const { opened, isMine } = capsuleState(capsule, user);
    const dist = location ? Geo.distanceMeters(capsule.lat, capsule.lng, location.lat, location.lng) : null;
    const inRange = location && dist <= CONFIG.UNLOCK_RADIUS_METERS;
    const canOpen = isMine || (opened && inRange);

    const stateHtml = (() => {
      if (canOpen)
        return `<span class="badge open">💌 open</span>`;
      if (opened)
        return `<span class="badge sealed">unlocked but out of range</span>`;
      return `<span class="badge sealed">🔒 sealed</span>`;
    })();

    let title, metaLines = [];
    if (isMine) {
      title = "Your own bottle — preview (no need to be there)";
    } else if (opened) {
      title = inRange ? "You found it. It opens." : "It drifted here — go closer.";
    } else {
      title = "Still sealed.";
    }
    metaLines.push(`opens ${Geo.fmtDate(capsule.unlock_at)}`);
    metaLines.push(`by ${authorName}`);
    if (dist !== null) metaLines.push(`${Geo.fmtDistance(dist)} away`);
    if (!opened && location) metaLines.push(`${Geo.daysUntil(capsule.unlock_at)} day(s) to go`);

    let content = "";
    if (canOpen) {
      content += `<div class="capsule-note">${esc(capsule.note || "— a bottle with no words. The silence says enough.")}</div>`;
      if (capsule.photo_url) content += `<img class="capsule-photo" src="${capsule.photo_url}" alt="capsule photo" />`;
      if (capsule.audio_url) content += `<br/><audio class="capsule-audio" controls src="${capsule.audio_url}"></audio>`;
    } else if (opened) {
      content = `<div class="capsule-locked"><div class="seal">💎</div><div class="dist">You are ${Geo.fmtDistance(dist)} away. It only opens within <b>${CONFIG.UNLOCK_RADIUS_METERS} m</b>. Walk to the pin.</div></div>`;
    } else {
      content = `<div class="capsule-locked"><div class="seal">🔒</div><div class="dist">This bottle is sealed until <b>${Geo.fmtDate(capsule.unlock_at)}</b> (${Geo.daysUntil(capsule.unlock_at)} days). Find the spot and come back on time.</div></div>`;
    }

    const body = document.getElementById("capsule-body");
    body.innerHTML = `
      <div class="capsule">
        <div class="capsule-state">${stateHtml}</div>
        <h3 class="capsule-title">${esc(capsule.title)}</h3>
        <p class="capsule-meta">${metaLines.map(esc).join(" &middot; ")}</p>
        ${content}
      </div>`;
    openModal("modal-capsule");
  };

  return {
    showToast,
    hideToast,
    openModal,
    closeModal,
    setAuthLabel,
    bindModalClosers,
    renderCapsuleView
  };
})();