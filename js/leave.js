const Leave = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  let step = 1; // 1=location, 2=write, 3=duration+confirm
  const DRAFT_KEY = "rtc_leave_draft";
  let draft = {
    place: null, lat: null, lng: null,
    note: "", photo: null, photoUrl: null,
    durationYears: 5,   // default 5 years
    reply: null         // {id, author, preview, year} when connecting
  };

  const durationOptions = [
    { label: "1 Year",              years: 1,  desc: "A short wait." },
    { label: "2 Years",             years: 2,  desc: "Let it breathe." },
    { label: "4 Years (graduation)", years: 4, desc: "Till the next batch walks here." },
    { label: "5 Years",             years: 5,  desc: "For whoever comes much later." },
    { label: "10 Years",            years: 10, desc: "A decade of waiting." },
    { label: "Forever",             years: 50, desc: "Always there, for whoever walks here." }
  ];

  const saveDraft = () => {
    try {
      const { photo, photoUrl, ...rest } = draft;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
    } catch (_) {}
  };

  const open = (preset) => {
    step = 1;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (_) {}
    const base = saved || {};
    draft = {
      place: base.place || null,
      lat: base.lat != null ? base.lat : null,
      lng: base.lng != null ? base.lng : null,
      note: base.note || "",
      photo: null, photoUrl: null,
      durationYears: base.durationYears || 5,
      reply: base.reply || null
    };
    if (preset) {
      if (preset.place) { draft.place = preset.place; draft.lat = preset.place.lat; draft.lng = preset.place.lng; }
      if (preset.reply) draft.reply = preset.reply;
      if (preset.lat != null) { draft.lat = preset.lat; draft.lng = preset.lng; }
      localStorage.removeItem(DRAFT_KEY);
    }
    // Pre-fill GPS if already known
    const loc = Explore.getLocation();
    if (loc && draft.lat == null) { draft.lat = loc.lat; draft.lng = loc.lng; }

    App.show("leave");
    render();
    saveDraft();
  };

  const progressDots = () => `
    <div class="step-dots">
      ${[1,2,3].map(i => `<div class="sdot ${i === step ? "on" : i < step ? "done" : ""}"></div>`).join("")}
    </div>`;

  const render = () => {
    const body = $("leave-body");
    let html = progressDots();
    if (step === 1) html += step1Html();
    else if (step === 2) html += step2Html();
    else html += step3Html();
    body.innerHTML = html;
    bind();
    saveDraft();
  };

  // -------- STEP 1: WHERE (auto-GPS) --------
  const step1Html = () => {
    const hasLoc = draft.lat != null;
    const locStatus = hasLoc
      ? `<div class="loc-status ok">📍 ${draft.place ? esc(draft.place.name) : `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`}</div>`
      : `<div class="loc-status">📍 Location not set</div>`;

    return `
      <div class="leave-inner">
        <h2 class="leave-title">${draft.reply ? "Connect your story" : "Drop a capsule"}</h2>
        <p class="leave-sub">${draft.reply
          ? `Responding to ${esc(draft.reply.author)}'s memory.`
          : "Your capsule is pinned to where you're standing right now."}</p>
        ${draft.reply ? `<div class="reply-preview"><div class="rp-label">${esc(draft.reply.author)} · ${draft.reply.year || ""}</div><div class="rp-quote">"${esc(draft.reply.preview)}"</div></div>` : ""}
        <button class="btn btn-primary btn-full" id="l-locate">◎ Use my current GPS location</button>
        ${locStatus}
        ${hasLoc && !draft.place ? `
          <div class="field mt">
            <label>Name this spot</label>
            <input id="l-name" type="text" placeholder="e.g. The mountain ridge, college bench, corner café…" />
          </div>` : ""}
        <div class="step-nav">
          <button class="btn btn-ghost" id="l-cancel">Cancel</button>
          <button class="btn btn-primary" id="l-next">Next →</button>
        </div>
      </div>`;
  };

  // -------- STEP 2: WRITE --------
  const step2Html = () => `
    <div class="leave-inner">
      <h2 class="leave-title">${draft.reply ? "What do you want to say?" : "Write your memory"}</h2>
      <p class="leave-sub">${draft.reply ? "Say what you felt. They'll read it at this exact spot." : "Be honest. Whoever finds this will feel it."}</p>
      ${draft.reply ? `<div class="reply-preview"><div class="rp-label">${esc(draft.reply.author)} · ${draft.reply.year || ""}</div><div class="rp-quote">"${esc(draft.reply.preview)}"</div></div>` : ""}
      <div class="field">
        <textarea id="l-note" rows="7" placeholder="${draft.reply
          ? "e.g. I came here alone too. Didn't know anyone else had done the same…"
          : "e.g. Came here alone. Stayed until sunrise. Felt like the city had finally stopped talking."}">${esc(draft.note)}</textarea>
      </div>
      <div class="field">
        <label class="file-label">
          <input type="file" id="l-photo" accept="image/*" hidden />
          <button class="btn btn-ghost btn-sm" id="l-photo-btn">📷 Add a photo (optional)</button>
          <span id="l-photo-pill" class="file-pill" hidden></span>
        </label>
      </div>
      <div class="step-nav">
        <button class="btn btn-ghost" id="l-back">← Back</button>
        <button class="btn btn-primary" id="l-next">Next →</button>
      </div>
    </div>`;

  // -------- STEP 3: DURATION + CONFIRM --------
  const step3Html = () => {
    const unlockYear = new Date().getFullYear() + draft.durationYears;
    const placeLabel = draft.place ? draft.place.name : "this spot";
    return `
      <div class="leave-inner">
        <h2 class="leave-title">How long should it wait?</h2>
        <p class="leave-sub">Choose when this capsule can be discovered. It still requires physical proximity to open.</p>
        <div class="duration-grid three-col">
          ${durationOptions.map(d => `
            <button class="dur-btn ${draft.durationYears === d.years ? "on" : ""}" data-years="${d.years}">
              <span class="dur-label">${d.label}</span>
              <span class="dur-desc">${d.desc}</span>
            </button>`).join("")}
        </div>
        <div class="unlock-preview">
          Unlocks in <b>${draft.durationYears === 50 ? "your lifetime" : draft.durationYears + " year" + (draft.durationYears > 1 ? "s" : "")}</b>
          ${draft.durationYears < 50 ? `— around <b>${unlockYear}</b>` : ""}
          · only within 100m of <b>${esc(placeLabel)}</b>
        </div>
        <div class="step-nav">
          <button class="btn btn-ghost" id="l-back">← Back</button>
          <button class="btn btn-primary" id="l-leave">${draft.reply ? "🤝 Connect these stories" : "Leave it here"}</button>
        </div>
      </div>`;
  };

  // -------- BINDINGS --------
  const bind = () => {
    const body = $("leave-body");
    const q = (sel) => body.querySelector(sel);
    if (q("#l-locate")) q("#l-locate").addEventListener("click", useLocation);
    if (q("#l-cancel")) q("#l-cancel").addEventListener("click", () => App.show("explore"));
    if (q("#l-next")) q("#l-next").addEventListener("click", next);
    if (q("#l-back")) q("#l-back").addEventListener("click", () => { step--; render(); });
    if (q("#l-name")) q("#l-name").addEventListener("input", (e) => {
      const n = e.target.value.trim();
      if (n) draft.place = { ...(draft.place || {}), name: n };
    });
    if (q("#l-note")) q("#l-note").addEventListener("input", (e) => (draft.note = e.target.value));
    if (q("#l-photo-btn")) q("#l-photo-btn").addEventListener("click", () => q("#l-photo").click());
    if (q("#l-photo")) q("#l-photo").addEventListener("change", onPhoto);
    body.querySelectorAll(".dur-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        draft.durationYears = Number(btn.dataset.years);
        render();
      });
    });
    if (q("#l-leave")) q("#l-leave").addEventListener("click", submit);
  };

  const useLocation = async () => {
    const btn = document.getElementById("l-locate");
    if (btn) { btn.disabled = true; btn.textContent = "Getting your location…"; }
    UI.showToast("Getting your GPS location…", false, true);
    try {
      const loc = await Geo.getCurrentPosition();
      draft.lat = loc.lat;
      draft.lng = loc.lng;
      draft.place = null;
      UI.hideToast();
      const places = await Data.listPlaces();
      const near = Data.findPlaceNear(places, loc.lat, loc.lng);
      if (near) {
        draft.place = near;
        UI.showToast(`📍 Near: ${near.name} — dropping here`);
      } else {
        UI.showToast("Location set. Name this spot to save it.");
      }
      render();
    } catch (e) {
      UI.hideToast();
      UI.showToast(e.message, true);
    } finally {
      const b = document.getElementById("l-locate");
      if (b) { b.disabled = false; b.textContent = "◎ Use my current GPS location"; }
    }
  };

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    draft.photo = file;
    const pill = document.getElementById("l-photo-pill");
    if (pill) { pill.hidden = false; pill.textContent = `🖼 ${file.name}`; }
  };

  const next = async () => {
    if (step === 1) {
      if (draft.lat == null) return UI.showToast("Tap the GPS button first.", true);
      if (!draft.place || !draft.place.id) {
        const nameEl = document.getElementById("l-name");
        const name = nameEl ? nameEl.value.trim() : "";
        if (!name) return UI.showToast("Give this spot a name.", true);
        try {
          draft.place = await Data.createPlace(name, draft.lat, draft.lng);
        } catch (e) { return UI.showToast(e.message, true); }
      }
    }
    if (step === 2 && !draft.note.trim()) return UI.showToast("Write something first.", true);
    step++;
    render();
  };

  const submit = async () => {
    const btn = $("l-leave");
    try {
      if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

      // Check storage before uploading photo
      let photoUrl = null;
      if (draft.photo) {
        const check = Data.checkStorageFor(draft.photo);
        if (!check.ok) {
          btn.disabled = false;
          btn.textContent = draft.reply ? "🤝 Connect these stories" : "Leave it here";
          UI.openModal("modal-plans");
          UI.showToast(`You need more storage (${Data.fmtBytes(check.limit - check.used)} left). Upgrade to continue uploading photos.`, true);
          return;
        }
        photoUrl = await Data.uploadFile(draft.photo, "memories");
      }
      const unlockAt = draft.durationYears >= 50
        ? new Date(Date.now() + 50 * 365 * 86400000)
        : new Date(Date.now() + draft.durationYears * 365 * 86400000);
      const mem = await Data.addMemory({
        placeId: draft.place.id,
        note: draft.note,
        lat: draft.lat,
        lng: draft.lng,
        year: new Date().getFullYear(),
        unlockAt,
        photo: photoUrl
      });
      if (draft.reply && draft.reply.id) {
        try { await Data.addLink(mem.id, draft.reply.id); } catch (_) {}
      }
      await App.loadAll();
      localStorage.removeItem(DRAFT_KEY);
      const unlockYear = new Date().getFullYear() + (draft.durationYears >= 50 ? 50 : draft.durationYears);
      $("leave-body").innerHTML = `
        <div class="done-screen">
          <div class="done-icon">🌊</div>
          <h2>${draft.reply ? "Stories connected." : "It's out there now."}</h2>
          <p>${draft.reply
            ? "Two people, same place, same feeling, different time.<br>Now you're part of the same story."
            : `Sealed at <b>${esc(draft.place ? draft.place.name : "your spot")}</b>.<br>Unlocks around <b>${unlockYear}</b> — when someone stands within 100m.`}</p>
          <div class="done-actions">
            <button class="btn btn-primary" id="done-map">See it on the map</button>
            <button class="btn btn-ghost" id="done-dash">View in Dashboard</button>
            <button class="btn btn-ghost" id="done-home">Back to home</button>
          </div>
        </div>`;
      $("done-map").addEventListener("click", () => App.show("explore"));
      const doneDash = $("done-dash");
      if (doneDash) doneDash.addEventListener("click", () => App.show("traces"));
      $("done-home").addEventListener("click", () => App.show("home"));
    } catch (e) {
      UI.showToast(e.message, true);
      if (btn) { btn.disabled = false; btn.textContent = draft.reply ? "🤝 Connect these stories" : "Leave it here"; }
    }
  };

  return { open };
})();