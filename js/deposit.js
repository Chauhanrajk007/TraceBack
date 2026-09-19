const Deposit = (() => {
  let pos = null;

  const todayPlus = (days) => {
    const d = new Date(Date.now() + days * 86400000);
    const off = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return off.toISOString().slice(0, 10);
  };

  const errEl = () => document.getElementById("d-err");

  const setError = (msg) => {
    const el = errEl();
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.hidden = false;
  };

  const coordsEl = () => document.getElementById("d-coords");

  const setPin = (lat, lng) => {
    pos = { lat, lng };
    Explore.setPin(lat, lng);
    const el = coordsEl();
    if (el) el.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  const renderForm = () => {
    const el = document.getElementById("deposit-form");
    el.innerHTML = `
      <div class="field">
        <label>Title</label>
        <input id="d-title" type="text" maxlength="80" placeholder="What do you call this moment?" />
      </div>
      <div class="field">
        <label>Note — today, a fear, a dream, advice</label>
        <textarea id="d-note" maxlength="2000" placeholder="Write what the future should hear..."></textarea>
      </div>
      <div class="field">
        <label>Photo (optional)</label>
        <div class="file-row">
          <button class="btn btn-ghost btn-sm file-btn">📷 Add photo<input id="d-photo" type="file" accept="image/*" /></button>
          <span id="d-photo-name" class="file-pill" hidden></span>
        </div>
      </div>
      <div class="field">
        <label>Song / voice note (optional)</label>
        <div class="file-row">
          <button class="btn btn-ghost btn-sm file-btn">🎵 Add audio<input id="d-audio" type="file" accept="audio/*" /></button>
          <span id="d-audio-holder" class="file-pill" hidden></span>
        </div>
      </div>
      <div class="field">
        <label>Opens on</label>
        <input id="d-date" type="date" min="${todayPlus(1)}" />
        <div class="chips">
          <span class="chip" data-days="30">+1 month</span>
          <span class="chip" data-days="365">+1 year</span>
          <span class="chip" data-days="1825">+5 years</span>
        </div>
      </div>
      <div class="pin-box">
        <div><b>Pin the spot</b> — click anywhere on the map.</div>
        <div class="coords" id="d-coords">not placed yet</div>
        <button class="btn btn-ghost btn-sm" type="button" id="d-use-location">📍 Use my location</button>
      </div>
      <button class="btn btn-primary deposit-submit" id="d-submit">⚡ Seal &amp; drop it</button>
      <div id="d-err" class="form-err" hidden></div>
    `;
    bindFormEvents();
  };

  const bindFormEvents = () => {
    const photoInput = document.getElementById("d-photo");
    const audioInput = document.getElementById("d-audio");

    photoInput.addEventListener("change", () => {
      const f = photoInput.files[0];
      const chip = document.getElementById("d-photo-name");
      if (f) {
        chip.textContent = `🖼 ${f.name}`;
        chip.hidden = false;
      } else chip.hidden = true;
    });

    audioInput.addEventListener("change", () => {
      const f = audioInput.files[0];
      const holder = document.getElementById("d-audio-holder");
      if (f) {
        holder.innerHTML = `🎵 ${f.name} <span class="x" data-clear-audio>✕</span>`;
        holder.hidden = false;
        holder.querySelector("[data-clear-audio]").onclick = () => {
          audioInput.value = "";
          holder.hidden = true;
        };
      } else holder.hidden = true;
    });

    document.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        document.getElementById("d-date").value = todayPlus(Number(chip.dataset.days));
        document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      })
    );

    document.getElementById("d-use-location").addEventListener("click", useLocationPin);
    document.getElementById("d-submit").addEventListener("click", submit);
  };

  const useLocationPin = async () => {
    try {
      const loc = await Geo.getCurrentPosition();
      setPin(loc.lat, loc.lng);
      Explore.focusOn(loc.lat, loc.lng);
      setError(null);
    } catch (e) {
      UI.showToast(e.message, true);
    }
  };

  const showPanel = () => {
    setError(null);
    document.getElementById("deposit-panel").hidden = false;
    Explore.setPickMode(true, onMapPick);
  };

  const hidePanel = () => {
    document.getElementById("deposit-panel").hidden = true;
    Explore.setPickMode(false);
    Explore.clearPin();
    pos = null;
  };

  const onMapPick = (lat, lng) => {
    setPin(lat, lng);
    setError(null);
  };

  const submit = async () => {
    if (!Data.currentUser()) {
      UI.showToast("Sign in first — bottles need an author", true);
      UI.openModal("modal-auth");
      return;
    }
    const title = document.getElementById("d-title").value.trim();
    const note = document.getElementById("d-note").value.trim();
    const dateStr = document.getElementById("d-date").value;
    const photo = document.getElementById("d-photo").files[0];
    const audio = document.getElementById("d-audio").files[0];

    if (!title) return setError("Give the bottle a title");
    if (!note && !photo && !audio) return setError("Add a note, photo, or audio");
    if (!pos) return setError("Drop the pin on the map");
    const unlock = new Date(dateStr + "T12:00:00");
    if (!dateStr || isNaN(unlock.getTime()) || unlock.getTime() <= Date.now()) {
      return setError("Pick an opening date in the future");
    }

    const btn = document.getElementById("d-submit");
    btn.disabled = true;
    btn.textContent = "Sealing…";
    setError(null);
    try {
      const [photoUrl, audioUrl] = await Promise.all([
        photo ? Data.uploadFile(photo, "photos") : Promise.resolve(null),
        audio ? Data.uploadFile(audio, "audio") : Promise.resolve(null)
      ]);
      await Data.addCapsule({
        title,
        note,
        photo: photoUrl,
        audio: audioUrl,
        lat: pos.lat,
        lng: pos.lng,
        unlockAt: unlock.toISOString(),
        authorId: Data.currentUser().id
      });
      UI.showToast("⏳ Bottle dropped. See you in the future.");
      hidePanel();
      resetForm();
      await App.refreshCapsules();
    } catch (e) {
      setError(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "⚡ Seal & drop it";
    }
  };

  const resetForm = () => {
    pos = null;
    renderForm();
  };

  return {
    renderForm,
    showPanel,
    hidePanel
  };
})();