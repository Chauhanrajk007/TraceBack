const Leave = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  let step = 1;
  const DRAFT_KEY = "rtc_leave_draft";
  let draft = {
    place: null,      // {id, name, lat, lng}
    lat: null,
    lng: null,
    note: "",
    photo: null,
    photoUrl: null,
    unlockAt: "now",  // "now" or ISO string
    reply: null       // {id, author, preview} — memory being connected to
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
    try {
      saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch (_) {}
    const base = saved || {};
    draft = {
      place: base.place || null,
      lat: base.lat != null ? base.lat : null,
      lng: base.lng != null ? base.lng : null,
      note: base.note || "",
      photo: null,
      photoUrl: null,
      unlockAt: base.unlockAt || "now",
      reply: base.reply || null
    };
    if (preset && (preset.place || preset.reply)) {
      if (preset.place) { draft.place = preset.place; draft.lat = preset.place.lat; draft.lng = preset.place.lng; }
      if (preset.reply) draft.reply = preset.reply;
      localStorage.removeItem(DRAFT_KEY);
    }
    App.show("leave");
    render();
    saveDraft();
  };

  const render = () => {
    const body = $("leave-body");
    const user = Data.currentUser();

    let html = `<div class="step-progress">
        ${[1, 2, 3, 4].map((i) => `<div class="step-dot ${i === step ? "on" : i < step ? "done" : ""}"><span>${i < step ? "✓" : i}</span></div>`).join("")}
      </div>`;

    if (step === 1) html += step1Html();
    else if (step === 2) html += step2Html();
    else if (step === 3) html += step3Html();
    else if (step === 4) html += step4Html();

    body.innerHTML = html;
    bind();
    saveDraft();
  };

  // --------- STEP 1: WHERE ---------
  const step1Html = () => {
    const presetName = draft.place ? draft.place.name : "";
    const at = draft.lat != null ? `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}` : "not chosen yet";
    return `
      <h1 class="leave-title">${draft.reply ? "Connect These Stories" : "Leave a Trace"}</h1>
      ${draft.reply
        ? `<p class="leave-sub">You found someone who felt the same way. Connecting at <b>${esc(draft.place ? draft.place.name : "this place")}</b>.</p>`
        : `<p class="leave-sub">Where are you standing?</p>`}
      <div class="card step-card">
        <div class="step-loc-buttons">
          <button class="btn btn-primary" id="l-locate">◎ Use my location</button>
          <button class="btn btn-ghost" id="l-pick">🗺 Choose on map</button>
        </div>
        <div class="loc-readout">📍 ${draft.place ? `Leaving trace at <b>${esc(draft.place.name)}</b>` : esc(at)}</div>
        <div class="field" ${draft.place ? "hidden" : ""} id="l-name-field">
          <label>Name this place</label>
          <input id="l-name" type="text" placeholder="e.g. The College Campus, corner café, mountain path…" value="${esc(presetName)}" />
        </div>
      </div>
      <div class="step-nav">
        <button class="btn btn-ghost" id="l-cancel">Cancel</button>
        <button class="btn btn-primary" id="l-next">Next</button>
      </div>`;
  };

  // --------- STEP 2: WHAT ---------
  const step2Html = () => `
      <h1 class="leave-title">${draft.reply ? "Connect These Stories" : "Leave a Trace"}</h1>
      ${draft.reply
        ? `<p class="leave-sub">You found someone who felt the same way.</p>`
        : `<p class="leave-sub">What do you want to leave behind?</p>`}
      <div class="card step-card">
        ${draft.reply ? `
          <div class="reply-box card">
            <div class="rp-meta"><b>${esc(draft.reply.author)}</b> (${draft.reply.year || "earlier"}) wrote:</div>
            <div class="rp-quote">"${esc(draft.reply.preview)}"</div>
          </div>
        ` : ""}
        <div class="field">
          <label>${draft.reply ? "Your memory (how you relate)" : "Your memory"}</label>
          <textarea id="l-note" rows="5" placeholder="${draft.reply ? "e.g. That's exactly why I came here. I still sit here thinking about the same thing…" : "Write something for whoever finds this…" }">${esc(draft.note)}</textarea>
        </div>
        <div class="field">
          <label>Add a photo <span class="opt">(optional)</span></label>
          <input type="file" id="l-photo" accept="image/*" hidden />
          <div class="file-row">
            <button class="btn btn-ghost btn-sm" id="l-photo-btn">＋ Add photo</button>
            <span class="file-pill" id="l-photo-pill" hidden></span>
          </div>
        </div>
      </div>
      <div class="step-nav">
        <button class="btn btn-ghost" id="l-back">← Back</button>
        <button class="btn btn-primary" id="l-next">Next</button>
      </div>`;

  // --------- STEP 3: WHEN ---------
  const step3Html = () => `
      <h1 class="leave-title">Leave a Trace</h1>
      <p class="leave-sub">When should people discover it?</p>
      <div class="card step-card">
        <div class="when-row">
          <button class="when-btn ${draft.unlockAt === "now" ? "on" : ""}" id="w-now">Now (within 50-100m)</button>
          <button class="when-btn ${draft.unlockAt !== "now" ? "on" : ""}" id="w-later">Future Date</button>
        </div>
        <div class="date-row" id="w-date-row" ${draft.unlockAt === "now" ? "hidden" : ""}>
          ${["1mo", "6mo", "1yr", "5yr"].map((c) => `<button class="chip" data-d="${c}">+ ${c}</button>`).join("")}
          <label class="date-custom"><input type="date" id="w-date" />pick date</label>
        </div>
        <p class="loc-readout" id="w-preview">It will unlock only when someone physically stands within 50–100m.</p>
      </div>
      <div class="step-nav">
        <button class="btn btn-ghost" id="l-back">← Back</button>
        <button class="btn btn-primary" id="l-next">Next</button>
      </div>`;

  // --------- STEP 4: LEAVE ---------
  const step4Html = () => {
    const whenLabel = draft.unlockAt === "now" ? "open now (when physically within 100m)" : `opens on ${Geo.fmtDate(draft.unlockAt)} (within 100m)`;
    const replyRow = draft.reply
      ? `<div class="review-row"><b>Connecting With</b><span>${esc(draft.reply.author)}'s memory — "${esc((draft.reply.preview || "").slice(0, 60))}${(draft.reply.preview || "").length > 60 ? "…" : ""}"</span></div>`
      : "";
    return `
      <h1 class="leave-title">${draft.reply ? "Connect These Stories" : "Leave a Trace"}</h1>
      <p class="leave-sub">${draft.reply ? "Two people. Same place. Same feeling. Different time." : "Ready to seal it in place."}</p>
      <div class="card step-card">
        <div class="review-row"><b>Place</b><span>${esc(draft.place ? draft.place.name : "unnamed spot")}</span></div>
        ${replyRow}
        <div class="review-row"><b>Memory</b><span>${esc((draft.note || "").slice(0, 90))}${(draft.note || "").length > 90 ? "…" : ""}</span></div>
        <div class="review-row"><b>Physical Unlock</b><span>${whenLabel}</span></div>
      </div>
      <div class="step-nav">
        <button class="btn btn-ghost" id="l-back">← Back</button>
        <button class="btn btn-primary" id="l-leave">${draft.reply ? "🤝 Connect These Stories" : "Leave it behind"}</button>
      </div>`;
  };

  // --------- bindings ---------
  const bind = () => {
    const el = $("leave-body");
    if (el.querySelector("#l-locate")) el.querySelector("#l-locate").addEventListener("click", useLocation);
    if (el.querySelector("#l-pick")) el.querySelector("#l-pick").addEventListener("click", pickOnMap);
    if (el.querySelector("#l-cancel")) el.querySelector("#l-cancel").addEventListener("click", () => App.show("explore"));
    if (el.querySelector("#l-next")) el.querySelector("#l-next").addEventListener("click", next);
    if (el.querySelector("#l-back")) el.querySelector("#l-back").addEventListener("click", () => { step--; render(); });
    if (el.querySelector("#l-name")) el.querySelector("#l-name").addEventListener("input", onName);
    if (el.querySelector("#l-note")) el.querySelector("#l-note").addEventListener("input", (e) => (draft.note = e.target.value));
    if (el.querySelector("#l-photo-btn")) el.querySelector("#l-photo-btn").addEventListener("click", () => el.querySelector("#l-photo").click());
    if (el.querySelector("#l-photo")) el.querySelector("#l-photo").addEventListener("change", onPhoto);
    if (el.querySelector("#w-now")) el.querySelector("#w-now").addEventListener("click", () => setWhen("now"));
    if (el.querySelector("#w-later")) el.querySelector("#w-later").addEventListener("click", () => setWhen("later"));
    if (el.querySelector("#w-date")) el.querySelector("#w-date").addEventListener("change", (e) => { if (e.target.value) draft.unlockAt = new Date(e.target.value + "T23:59:59").toISOString(); render(); });
    el.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      const d = c.dataset.d;
      const now = Date.now();
      const map = { mo: 30 * 86400000, yr: 365 * 86400000 };
      const mul = Number(d.slice(0, -2));
      draft.unlockAt = new Date(now + mul * map[d.slice(-2)]).toISOString();
      render();
    }));
    if (el.querySelector("#l-leave")) el.querySelector("#l-leave").addEventListener("click", submit);
  };

  // --------- step actions ---------
  const useLocation = async () => {
    const btn = el("#l-locate");
    if (btn) { btn.disabled = true; btn.textContent = "Finding your location…"; }
    UI.showToast("Finding your location…", false, true);
    try {
      const loc = await Geo.getCurrentPosition();
      draft.lat = loc.lat;
      draft.lng = loc.lng;
      draft.place = null;
      UI.hideToast();
      render();
    } catch (e) {
      UI.hideToast();
      UI.showToast(e.message, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "◎ Use my location"; }
    }
  };

  const pickOnMap = () => {
    App.show("explore");
    Explore.setPickMode(true, (lat, lng) => {
      draft.lat = lat;
      draft.lng = lng;
      draft.place = null;
      Explore.setPickMode(false);
      App.show("leave");
      render();
    });
  };

  const onName = (e) => {
    const name = e.target.value.trim();
    if (name) draft.place = { name };
  };

  const onPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    draft.photo = file;
    const pill = $("l-photo-pill");
    if (pill) {
      pill.hidden = false;
      pill.textContent = `🖼 ${file.name}`;
    }
  };

  const setWhen = (mode) => {
    if (mode === "now") draft.unlockAt = "now";
    else draft.unlockAt = new Date(Date.now() + 30 * 86400000).toISOString();
    render();
  };

  const next = async () => {
    if (step === 1) {
      if (!draft.place || !draft.place.id) {
        // create/find the place
        const name = $("l-name").value.trim();
        if (draft.lat == null || draft.lng == null) return UI.showToast("Choose your location first.", true);
        const places = await Data.listPlaces();
        const near = Data.findPlaceNear(places, draft.lat, draft.lng);
        if (near) draft.place = near;
        else if (name) {
          try {
            draft.place = await Data.createPlace(name, draft.lat, draft.lng);
          } catch (e) { return UI.showToast(e.message, true); }
        } else {
          return UI.showToast("Name this place so others can find it.", true);
        }
      }
    }
    if (step === 2 && !draft.note.trim()) return UI.showToast("Write something first.", true);
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
        lat: draft.lat != null ? draft.lat : draft.place.lat,
        lng: draft.lng != null ? draft.lng : draft.place.lng,
        year: new Date().getFullYear(),
        unlockAt: draft.unlockAt === "now" ? new Date() : draft.unlockAt,
        photo: photoUrl
      });
      if (draft.reply && draft.reply.id) {
        try { await Data.addLink(mem.id, draft.reply.id); } catch (_) { /* trail link is best-effort */ }
      }
      App.loadAll();
      localStorage.removeItem(DRAFT_KEY);
      const connected = draft.reply
        ? `<div class="done-connected">
            <span class="badge open">✨ Connected Story</span>
            <p><b>Same place. Same feeling. Different time.</b></p>
            <p>Your memory is now quietly linked with <b>${esc(draft.reply.author)}</b>'s trace. Now you are part of the same story.</p>
          </div>`
        : "";
      document.getElementById("leave-body").innerHTML = `
        <div class="done card">
          <div class="stub-icon">🌊</div>
          <h1>${draft.reply ? "Stories Connected." : "It's out there now."}</h1>
          <p>${draft.reply ? "Two people years apart, bound by this spot." : "Someone will find it when they walk here.<br />Tomorrow, or years from now."}</p>
          ${connected}
          <div class="hero-actions">
            <button class="btn btn-primary" id="done-explore">Find it on the map</button>
            <button class="btn btn-ghost" id="done-leave">Back to Home</button>
          </div>
        </div>`;
      document.getElementById("done-explore").addEventListener("click", () => App.show("explore"));
      document.getElementById("done-leave").addEventListener("click", () => { App.show("home"); });
    } catch (e) {
      UI.showToast(e.message, true);
    }
  };

  const el = (id) => document.getElementById(id);

  return { open };
})();