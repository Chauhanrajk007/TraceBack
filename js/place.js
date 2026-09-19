const Place = (() => {
  let currentPlace = null;
  let currentMemories = [];

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

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
    return { canOpen: dist <= CONFIG.UNLOCK_RADIUS_METERS, opened: true, mine: false, dist };
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
      render();
    } catch (e) {
      UI.showToast(e.message, true);
    }
  };

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

    body.innerHTML = head + timeline;
    document.getElementById("place-leave").addEventListener("click", () => {
      App.startLeave({ place: currentPlace, fromPlace: true });
    });
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
    } else if (st.opened) {
      const dist = st.dist != null ? `You are ${Geo.fmtDistance(st.dist)} away. It opens within ${CONFIG.UNLOCK_RADIUS_METERS} m.` : "Open a spot nearby — walk to the pin.";
      content = `<div class="memory-locked"><div class="seal">💎</div><div>${dist}</div></div>`;
    } else {
      const when = new Date(m.unlock_at);
      content = `<div class="memory-locked"><div class="seal">🔒</div><div>This trace stays sealed until <b>${Geo.fmtDate(m.unlock_at)}</b> (${Geo.daysUntil(m.unlock_at)} day${Geo.daysUntil(m.unlock_at) === 1 ? "" : "s"}). Come back when it opens.</div></div>`;
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

  return { show, refresh };
})();