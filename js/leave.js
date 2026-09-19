const Leave = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  let step = 1;
  const DRAFT_KEY = "rtc_leave_draft";
  let draft = {
    place: null,
    lat: null,
    lng: null,
    note: "",
    photo: null,
    photoUrl: null,
    reply: null   // {id, author, preview, year} when connecting stories
  };

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
      photo: null,
      photoUrl: null,
      reply: base.reply || null
    };
    if (preset) {
      if (preset.place) { draft.place = preset.place; draft.lat = preset.place.lat; draft.lng = preset.place.lng; }
      if (preset.reply) draft.reply = preset.reply;
      localStorage.removeItem(DRAFT_KEY);
    }
    // If we already have GPS from Explore, pre-fill it
    const loc = Explore.getLocation();
    if (loc && draft.lat == null) {
      draft.lat = loc.lat;
      draft.lng = loc.lng;
    }
    App.show("leave");
    render();
    saveDraft();
  };

  const render = () => {
    const body = $("leave-body");
    let html = `<div class="step-progress">
        ${[1, 2, 3].map((i) => `<div class="step-dot ${i === step ? "on" : i < step ? "done" : ""}"><span>${i < step ? "✓" : i}</span></div>`).join("")}
      </div>`;
    if (step === 1) html += step1Html();
    else if (step === 2) html += step2Html();
    else if (step === 3) html += step3Html();
    body.innerHTML = html;
    bind();
    saveDraft();
  };

  // STEP 1: LOCATION (GPS only)
  const step1Html = () => {
    const hasLoc = draft.lat != null;
    const locLine = hasLoc
      ? `<div class="loc-readout loc-ok">📍 ${draft.place ? esc(draft.place.name) : `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`}</div>`
      : `<div class="loc-readout loc-wait">📍 Location not set yet</div>`;

    const nameField = !draft.place ? `
      <div class="field" id="l-name-field">
        <label>Give this spot a name</label>
        <input id="l-name" type="text" placeholder="e.g. The bench by the gate, college ground, mountain path…" />
      </div>` : "";

    return `
      <h1 class="leave-title">${draft.reply ? "Connect These Stories" : "Leave a Trace"}</h1>
      <p class="leave-sub">${draft.reply
        ? `You felt what ${esc(draft.reply.author)} felt. Connect your memory to theirs.`
        : "Your trace will only be readable when someone physically stands here."}</p>
      ${draft.reply ? `
        <div class="reply-preview card">
          <div class="rp-label">Connecting with</div>
          <div class="rp-author">${esc(draft.reply.author)} · ${draft.reply.year || "earlier"}</div>
          <div class="rp-quote">"${esc(draft.reply.preview)}"</div>
        </div>` : ""}
      <div class="card step-card">
        <p class="step-hint">We use your real GPS location so the trace is pinned exactly where you are standing.</p>
        <button class="btn btn-primary" id="l-locate">◎ Use my current location</button>
        ${locLine}
        ${nameField}
      </div>
      <div class="step-nav">
        <button class="btn btn-ghost" id="l-cancel">Cancel</button>
        <button class="btn btn-primary" id="l-next">Next →</button>
      </div>`;
  };

  // STEP 2: MEMORY
  const step2Html = () => `
    <h1 class="leave-title">${draft.reply ? "Connect These Stories" : "Leave a Trace"}</h1>
    <p class="leave-sub">${draft.reply ? "What do you want to say to them?" : "What do you want to leave behind?"}</p>
    ${draft.reply ? `
      <div class="reply-preview card">
        <div class="rp-label">You're responding to</div>
        <div class="rp-author">${esc(draft.reply.author)} · ${draft.reply.year || "earlier"}</div>
        <div class="rp-quote">"${esc(draft.reply.preview)}"</div>
      </div>` : ""}
    <div class="card step-card">
      <div class="field">
        <label>${draft.reply ? "Your memory — how you relate" : "Your memory"}</label>
        <textarea id="l-note" rows="6" placeholder="${draft.reply
          ? "e.g. I came here alone too. I didn't know this spot had already held someone before me…"
          : "Write something for whoever finds this. Be honest — they'll feel it."}">${esc(draft.note)}</textarea>
      </div>
      <div class="field">
        <label>Photo <span class="opt">(optional)</span></label>
        <input type="file" id="l-photo" accept="image/*" hidden />
        <div class="file-row">
          <button class="btn btn-ghost btn-sm" id="l-photo-btn">＋ Add photo</button>
          <span class="file-pill" id="l-photo-pill" hidden></span>
        </div>
      </div>
    </div>
    <div class="step-nav">
      <button class="btn btn-ghost" id="l-back">← Back</button>
      <button class="btn btn-primary" id="l-next">Next →</button>
    </div>`;

  // STEP 3: CONFIRM & LEAVE
  const step3Html = () => {
    const placeLabel = draft.place ? draft.place.name : "this spot";
    return `
      <h1 class="leave-title">${draft.reply ? "Connect These Stories" : "Leave it behind"}</h1>
      <p class="leave-sub">${draft.reply
        ? "Two people. Same place. Same feeling. Different time."
        : "Someone will find this when they physically walk here."}</p>
      <div class="card step-card review-card">
        <div class="review-row"><b>Place</b><span>${esc(placeLabel)}</span></div>
        ${draft.reply ? `<div class="review-row"><b>Connecting with</b><span>"${esc((draft.reply.preview || "").slice(0, 60))}${(draft.reply.preview || "").length > 60 ? "…" : ""}"</span></div>` : ""}
        <div class="review-row"><b>Memory</b><span>${esc((draft.note || "").slice(0, 100))}${(draft.note || "").length > 100 ? "…" : ""}</span></div>
        <div class="review-row"><b>Unlocks</b><span>When someone stands within ${CONFIG.UNLOCK_RADIUS_METERS || 100}m of this spot</span></div>
      </div>
      <div class="step-nav">
        <button class="btn btn-ghost" id="l-back">← Back</button>
        <button class="btn btn-primary" id="l-leave">${draft.reply ? "🤝 Connect these stories" : "Leave it here"}</button>
      </div>`;
  };

  // BINDINGS
  const bind = () => {
    const body = $("leave-body");
    const q = (sel) => body.querySelector(sel);
    if (q("#l-locate")) q("#l-locate").addEventListener("click", useLocation);
    if (q("#l-cancel")) q("#l-cancel").addEventListener("click", () => App.show("explore"));
    if (q("#l-next")) q("#l-next").addEventListener("click", next);
    if (q("#l-back")) q("#l-back").addEventListener("click", () => { step--; render(); });
    if (q("#l-name")) q("#l-name").addEventListener("input", (e) => {
      const name = e.target.value.trim();
      if (name) draft.place = { ...draft.place, name };
    });
    if (q("#l-note")) q("#l-note").addEventListener("input", (e) => (draft.note = e.target.value));
    if (q("#l-photo-btn")) q("#l-photo-btn").addEventListener("click", () => q("#l-photo").click());
    if (q("#l-photo")) q("#l-photo").addEventListener("change", onPhoto);
    if (q("#l-leave")) q("#l-leave").addEventListener("click", submit);
  };

  const useLocation = async () => {
    const btn = document.getElementById("l-locate");
    if (btn) { btn.disabled = true; btn.textContent = "Finding you…"; }
    UI.showToast("Getting your GPS location…", false, true);
    try {
      const loc = await Geo.getCurrentPosition();
      draft.lat = loc.lat;
      draft.lng = loc.lng;
      draft.place = null;
      UI.hideToast();
      // Check if an existing place is nearby
      const places = await Data.listPlaces();
      const near = Data.findPlaceNear(places, loc.lat, loc.lng);
      if (near) {
        draft.place = near;
        UI.showToast(`📍 Found: ${near.name}`);
      } else {
        UI.showToast("Location locked. Name this spot to leave a trace.");
      }
      render();
    } catch (e) {
      UI.hideToast();
      UI.showToast(e.message, true);
    } finally {
      const b = document.getElementById("l-locate");
      if (b) { b.disabled = false; b.textContent = "◎ Use my current location"; }
    }
  };

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    draft.photo = file;
    const pill = $("l-photo-pill");
    if (pill) { pill.hidden = false; pill.textContent = `🖼 ${file.name}`; }
  };

  const next = async () => {
    if (step === 1) {
      if (draft.lat == null || draft.lng == null) return UI.showToast("Tap 'Use my current location' first.", true);
      if (!draft.place || !draft.place.id) {
        const name = (document.getElementById("l-name") || {}).value || "";
        if (!name.trim()) return UI.showToast("Give this spot a name so others can find it.", true);
        try {
          draft.place = await Data.createPlace(name.trim(), draft.lat, draft.lng);
        } catch (e) { return UI.showToast(e.message, true); }
      }
    }
    if (step === 2 && !draft.note.trim()) return UI.showToast("Write something first — even a sentence.", true);
    step++;
    render();
  };

  const submit = async () => {
    try {
      const btn = $("l-leave");
      if (btn) { btn.disabled = true; btn.textContent = "Leaving it behind…"; }
      let photoUrl = null;
      if (draft.photo) photoUrl = await Data.uploadFile(draft.photo, "memories");
      const mem = await Data.addMemory({
        placeId: draft.place.id,
        note: draft.note,
        lat: draft.lat,
        lng: draft.lng,
        year: new Date().getFullYear(),
        unlockAt: new Date(),
        photo: photoUrl
      });
      if (draft.reply && draft.reply.id) {
        try { await Data.addLink(mem.id, draft.reply.id); } catch (_) {}
      }
      await App.loadAll();
      localStorage.removeItem(DRAFT_KEY);
      $("leave-body").innerHTML = `
        <div class="done card">
          <div class="done-icon">🌊</div>
          <h1>${draft.reply ? "Stories Connected." : "It's out there now."}</h1>
          <p>${draft.reply
            ? `Two people — different times, same place, same feeling.<br>Now you're part of the same story.`
            : `Someone will find it when they walk here.<br>Tomorrow. Or years from now.`}</p>
          <div class="hero-actions">
            <button class="btn btn-primary" id="done-explore">See it on the map</button>
            <button class="btn btn-ghost" id="done-home">Back to home</button>
          </div>
        </div>`;
      $("done-explore").addEventListener("click", () => App.show("explore"));
      $("done-home").addEventListener("click", () => App.show("home"));
    } catch (e) {
      UI.showToast(e.message, true);
      const btn = $("l-leave");
      if (btn) { btn.disabled = false; btn.textContent = "Leave it here"; }
    }
  };

  return { open };
})();