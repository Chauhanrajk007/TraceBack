const Place = (() => {
  let currentPlace = null;
  let currentMemories = [];
  let linksMap = {};

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const radius = () => CONFIG.UNLOCK_RADIUS_METERS || 100;

  // a memory is readable when its time has come AND you're at the spot — or it's yours
  const readable = (m) => {
    const user = Data.currentUser();
    const mine = user && m.author_id === user.id;
    if (mine) return { canOpen: true, opened: true, mine: true };
    const opened = new Date(m.unlock_at).getTime() <= Date.now();
    if (!opened) return { canOpen: false, opened: false, mine: false };
    const loc = Explore.getLocation();
    if (!loc) return { canOpen: false, opened: true, mine: false };
    const dist = Geo.distanceMeters(m.lat, m.lng, loc.lat, loc.lng);
    return { canOpen: dist <= radius(), opened: true, mine: false, dist };
  };

  const show = async (place) => {
    currentPlace = place;
    App.show("place");
    Place.refresh();
    Explore.resize();
  };

  const refresh = async () => {
    try {
      currentMemories = await Data.listMemoriesForPlace(currentPlace.id);
      linksMap = {};
      try {
        const links = await Data.listLinks();
        const ids = new Set(currentMemories.map((m) => m.id));
        for (const l of links || []) {
          if (ids.has(l.from_memory_id)) linksMap[l.from_memory_id] = (linksMap[l.from_memory_id] || 0) + 1;
          if (ids.has(l.to_memory_id)) linksMap[l.to_memory_id] = (linksMap[l.to_memory_id] || 0) + 1;
        }
      } catch (_) { /* links are secondary — non-blocking */ }
      render();
    } catch (e) {
      UI.showToast(e.message, true);
    }
  };

  const placeDistance = () => {
    const loc = Explore.getLocation();
    if (!loc) return null;
    return Geo.distanceMeters(currentPlace.lat, currentPlace.lng, loc.lat, loc.lng);
  };

  // ---------- proximity banner ----------
  const renderProximity = () => {
    const R = radius();
    const d = placeDistance();
    if (d == null) {
      return `
        <div class="prox wait">
          <div class="px-ico">📡</div>
          <div class="px-body">
            <b>Traces here stay locked until you reach the spot.</b>
            <span>Nothing opens remotely — share your location to see how close you are.</span>
            <button class="btn btn-primary btn-sm" id="prox-locate">◎ Find my location</button>
          </div>
        </div>`;
    }
    if (d <= R) {
      return `
        <div class="prox on">
          <div class="px-ico">✨</div>
          <div class="px-body">
            <b>You're here. Someone was here before you.</b>
            <span>Everything within ${R} m is open.</span>
          </div>
        </div>`;
    }
    const nearby = d <= Math.max(300, R * 3)
      ? `A trace is nearby — ${Math.round(d)} m away. Walk closer to open it.`
      : `You're ${Geo.fmtDistance(d)} away. Reach this location to open what they left.`;
    return `
      <div class="prox off">
        <div class="px-ico">📍</div>
        <div class="px-body">
          <b>${nearby}</b>
          <span>Memories here unlock only when you're physically present.</span>
        </div>
      </div>`;
  };

  // ---------- Then → Now ----------
  const renderThenNow = () => {
    const years = [...new Set(currentMemories.map((m) => m.year))].sort((a, b) => a - b);
    if (years.length < 2) return "";
    const firstY = years[0];
    const lastY = years[years.length - 1];
    const first =
      currentMemories.find((m) => m.year === firstY && m.photo_url) ||
      currentMemories.find((m) => m.year === firstY);
    const last =
      currentMemories.find((m) => m.year === lastY && m.photo_url) ||
      currentMemories.find((m) => m.year === lastY);
    if (!first || !last) return "";

    const tile = (m, label, cls) => {
      const photo = m.photo_url
        ? `<img class="pp-photo" src="${m.photo_url}" alt="memory photo" />`
        : `<div class="pp-name">${esc(m.year)}</div>`;
      const note = m.note
        ? `"${esc(m.note.slice(0, 60))}"${m.note.length > 60 ? "…" : ""}`
        : "";
      return `
        <div class="pp-tile ${cls}">
          ${photo}
          <div class="pp-meta">
            <b>${label}</b>
            <span>${m.year} · ${esc(Data.getDisplayName(m.author_id))}</span>
          </div>
          ${note ? `<div class="pp-note">${note}</div>` : ""}
        </div>`;
    };

    return `
      <div class="thennow-strip">
        <h3 class="tn-head">Then → Now · how this place changed</h3>
        <div class="pp-grid">
          ${tile(first, "Then", "then")}
          <div class="pp-arrow">➜</div>
          ${tile(last, "Now", "now")}
        </div>
        <p class="tn-foot">The people change. The place changes. The memories remain.</p>
      </div>`;
  };

  // ---------- render ----------
  const render = () => {
    const body = document.getElementById("place-body");
    const ms = currentMemories;
    const people = new Set(ms.map((m) => m.author_id)).size;
    const years = ms.length ? [Math.min(...ms.map((m) => m.year)), Math.max(...ms.map((m) => m.year))] : null;

    const head = `
      <div class="place-head">
        <div class="place-name">${esc(currentPlace.name)}</div>
        <div class="place-tag">People were here before you.</div>
        <div class="place-meta">${people} ${people === 1 ? "person" : "people"} left traces here
          ${years ? (years[0] === years[1] ? ` · ${years[0]}` : ` · ${years[0]} → ${years[1]}`) : ""}
        </div>
        <button class="btn btn-primary" id="place-leave">Leave a trace here</button>
      </div>`;

    const timeline = ms.length ? renderTimeline() : `
      <div class="card empty-place">
        <div class="stub-icon">🕰️</div>
        <p>No one has left a trace here yet.<br />Be the first — leave a memory for whoever comes next.</p>
        <button class="btn btn-primary" id="place-leave">Leave the first trace</button>
      </div>`;

    body.innerHTML = head + renderProximity() + renderThenNow() + timeline;

    const leaveBtn = document.getElementById("place-leave");
    if (leaveBtn) {
      leaveBtn.addEventListener("click", () => App.startLeave({ place: currentPlace, fromPlace: true }));
    }
    const locateBtn = document.getElementById("prox-locate");
    if (locateBtn) locateBtn.addEventListener("click", onLocate);
    document.querySelectorAll(".mem-reply").forEach((b) =>
      b.addEventListener("click", () => onReply(b.dataset.reply))
    );
  };

  const renderTimeline = () => {
    const byYear = {};
    for (const m of currentMemories) {
      (byYear[m.year] = byYear[m.year] || []).push(m);
    }
    const years = Object.keys(byYear).sort((a, b) => b - a);

    let html = `<div class="timeline">`;
    for (const year of years) {
      html += `<div class="timeline-year">${year}</div>`;
      for (const m of byYear[year]) {
        html += memoryCard(m);
      }
    }
    html += `</div>`;
    return html;
  };

  const memoryCard = (m) => {
    const st = readable(m);
    const author = Data.getDisplayName(m.author_id);

    let content;
    if (st.canOpen) {
      content = `<div class="memory-note">${esc(m.note || "— no words. the silence says enough —")}</div>`;
      if (m.photo_url) content += `<img class="memory-photo" src="${m.photo_url}" alt="memory photo" />`;
      if (linksMap[m.id]) content += `<div class="memory-links">🪢 This trace is connected to a story trail.</div>`;
      if (!st.mine) {
        content += `<button class="btn btn-ghost btn-sm mem-reply" data-reply="${m.id}">I felt this too — connect</button>`;
      }
    } else if (st.opened) {
      const dist = st.dist != null
        ? `You are ${Geo.fmtDistance(st.dist)} away · it opens within ${radius()} m.`
        : "Enable your location to unlock — you have to reach this spot.";
      content = `<div class="memory-locked"><div class="seal">💎</div><div>${dist}</div></div>`;
    } else {
      const when = new Date(m.unlock_at);
      const d = Geo.daysUntil(m.unlock_at);
      content = `<div class="memory-locked"><div class="seal">🔒</div><div>This trace stays sealed until <b>${Geo.fmtDate(m.unlock_at)}</b> (${d} day${d === 1 ? "" : "s"}). Come back when it opens.</div></div>`;
    }

    return `
      <div class="memory card">
        <div class="memory-head">
          <span class="author">${esc(author)}</span>
          <span class="badge ${st.canOpen ? "open" : "sealed"}">${st.mine ? "yours" : st.canOpen ? "open" : "sealed"}</span>
        </div>
        ${content}
      </div>`;
  };

  const onLocate = async () => {
    UI.showToast("Finding your location…", false, true);
    try {
      const loc = await Geo.getCurrentPosition();
      Explore.setUserLocation(loc);
      UI.hideToast();
      refresh();
    } catch (e) {
      UI.hideToast();
      UI.showToast(e.message, true);
    }
  };

  const onReply = (memoryId) => {
    const m = currentMemories.find((x) => x.id === memoryId);
    if (!m) return;
    App.startLeave({
      place: currentPlace,
      fromPlace: true,
      reply: { id: m.id, author: Data.getDisplayName(m.author_id), preview: m.note }
    });
  };

  return { show, refresh };
})();