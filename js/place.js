const Place = (() => {
  let currentPlace = null;
  let currentMemories = [];
  let allLinks = [];

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const R = () => CONFIG.UNLOCK_RADIUS_METERS || 100;

  // A memory is readable when its unlock date has passed AND user is within radius (or it's theirs)
  const readable = (m) => {
    const user = Data.currentUser();
    if (user && m.author_id === user.id) return { canOpen: true, mine: true };
    const unlocked = new Date(m.unlock_at).getTime() <= Date.now();
    if (!unlocked) return { canOpen: false, future: true };
    const loc = Explore.getLocation();
    if (!loc) return { canOpen: false, noLoc: true };
    const dist = Geo.distanceMeters(m.lat, m.lng, loc.lat, loc.lng);
    return { canOpen: dist <= R(), dist };
  };

  const show = async (place) => {
    currentPlace = place;
    App.show("place");
    Explore.resize();
    await refresh();
  };

  const refresh = async () => {
    try {
      currentMemories = await Data.listMemoriesForPlace(currentPlace.id);
      try { allLinks = await Data.listLinks(); } catch (_) { allLinks = []; }
      render();
    } catch (e) {
      UI.showToast(e.message, true);
    }
  };

  const placeDistance = () => {
    const loc = Explore.getLocation();
    if (!loc || !isFinite(currentPlace.lat) || !isFinite(currentPlace.lng)) return null;
    return Geo.distanceMeters(currentPlace.lat, currentPlace.lng, loc.lat, loc.lng);
  };

  // ---------- RENDER ----------
  const render = () => {
    const body = document.getElementById("place-body");
    const people = new Set(currentMemories.map((m) => m.author_id)).size;

    body.innerHTML = `
      ${renderHeader(people)}
      ${renderProximityBanner()}
      ${renderStoryTrail()}
      ${renderPeople()}
      ${renderConnectedStories()}
      ${renderLeaveBtn()}
    `;
    bindEvents();
  };

  // ---------- HEADER ----------
  const renderHeader = (people) => `
    <div class="place-header">
      <h1 class="place-name">${esc(currentPlace.name)}</h1>
      <p class="place-subtitle">${people > 0 ? "People were here before you." : "No traces yet. Be the first."}</p>
      ${people > 0 ? `<p class="place-count">${people} ${people === 1 ? "person" : "people"} left something here</p>` : ""}
    </div>`;

  // ---------- PROXIMITY BANNER ----------
  const renderProximityBanner = () => {
    const d = placeDistance();
    if (d == null) return `
      <div class="prox-banner wait">
        <span class="prox-icon">📍</span>
        <div class="prox-text">
          <b>Content is locked to this spot.</b>
          <span>Memories only unlock when you physically stand within ${R()}m. Tap to find your location.</span>
          <button class="btn btn-sm btn-primary" id="prox-locate">◎ Find my location</button>
        </div>
      </div>`;
    if (d <= R()) return `
      <div class="prox-banner here">
        <span class="prox-icon">✨</span>
        <div class="prox-text">
          <b>You're here. Someone was here before you.</b>
          <span>You're ${Math.round(d)}m away — memories are unlocked.</span>
        </div>
      </div>`;
    return `
      <div class="prox-banner away">
        <span class="prox-icon">🔒</span>
        <div class="prox-text">
          <b>${d <= 500 ? `A trace is nearby — ${Math.round(d)}m away.` : `You are ${Geo.fmtDistance(d)} away.`}</b>
          <span>Walk within ${R()}m of this spot to unlock the memories.</span>
          <button class="btn btn-sm btn-ghost" id="prox-locate">◎ Refresh GPS</button>
        </div>
      </div>`;
  };

  // ---------- STORY TRAIL (chronological timeline) ----------
  const renderStoryTrail = () => {
    if (!currentMemories.length) return `
      <section class="place-section">
        <div class="section-head"><h2>Stories</h2></div>
        <div class="empty-state">
          <div class="empty-icon">🌱</div>
          <p>No traces here yet.<br>Be the first to leave something.</p>
        </div>
      </section>`;

    // Sort oldest first for the trail
    const sorted = [...currentMemories].sort((a, b) => a.year - b.year);

    const items = sorted.map((m, i) => {
      const st = readable(m);
      const author = Data.getDisplayName(m.author_id);
      const isLast = i === sorted.length - 1;

      let content;
      if (st.canOpen) {
        content = `
          <div class="trail-memory open">
            <div class="trail-quote">"${esc(m.note)}"</div>
            ${m.photo_url ? `<img class="trail-photo" src="${esc(m.photo_url)}" alt="photo" />` : ""}
            <button class="btn btn-ghost btn-sm connect-btn" data-id="${m.id}">
              🤝 I felt this too — Connect my story
            </button>
          </div>`;
      } else if (st.future) {
        const d = Geo.daysUntil(m.unlock_at);
        content = `<div class="trail-locked"><span>⏳</span> Opens in ${d} day${d === 1 ? "" : "s"}</div>`;
      } else {
        const dist = st.dist != null ? `${Math.round(st.dist)}m away` : "Location unknown";
        content = `<div class="trail-locked"><span>🔒</span> Walk to within ${R()}m to read this — ${dist}</div>`;
      }

      return `
        <div class="trail-item">
          <div class="trail-spine">
            <div class="trail-dot ${st.canOpen ? "open" : "locked"}"></div>
            ${!isLast ? `<div class="trail-line"></div>` : ""}
          </div>
          <div class="trail-body">
            <div class="trail-meta"><b>${esc(author)}</b> · ${m.year}</div>
            ${content}
          </div>
        </div>`;
    }).join("");

    return `
      <section class="place-section">
        <div class="section-head">
          <h2>Stories</h2>
          <p>What people experienced here, over time.</p>
        </div>
        <div class="story-trail">${items}</div>
      </section>`;
  };

  // ---------- PEOPLE ----------
  const renderPeople = () => {
    if (!currentMemories.length) return "";
    const peopleMap = new Map();
    currentMemories.forEach((m) => {
      const p = peopleMap.get(m.author_id) || { name: Data.getDisplayName(m.author_id), years: [], count: 0 };
      p.years.push(m.year);
      p.count++;
      peopleMap.set(m.author_id, p);
    });

    const cards = Array.from(peopleMap.values()).map((p) => {
      const yearSpan = p.years.length > 1
        ? `${Math.min(...p.years)} → ${Math.max(...p.years)}`
        : `${p.years[0]}`;
      const initial = (p.name || "S")[0].toUpperCase();
      return `
        <div class="person-pill">
          <div class="person-avatar">${esc(initial)}</div>
          <div class="person-info">
            <div class="person-name">${esc(p.name)}</div>
            <div class="person-meta">${p.count} trace${p.count === 1 ? "" : "s"} · ${yearSpan}</div>
          </div>
        </div>`;
    }).join("");

    return `
      <section class="place-section">
        <div class="section-head">
          <h2>People</h2>
          <p>Who was here before you.</p>
        </div>
        <div class="people-row">${cards}</div>
      </section>`;
  };

  // ---------- CONNECTED STORIES (Find someone like you) ----------
  const renderConnectedStories = () => {
    const memIds = new Set(currentMemories.map((m) => m.id));
    const pairs = [];

    allLinks.forEach((l) => {
      const from = currentMemories.find((m) => m.id === l.from_memory_id);
      const to = currentMemories.find((m) => m.id === l.to_memory_id);
      if (from && to) pairs.push({ earlier: from.year <= to.year ? from : to, later: from.year <= to.year ? to : from });
    });

    if (!pairs.length) return "";

    const pairsHtml = pairs.map((p) => `
      <div class="connection-card">
        <div class="connection-label">Same place. Same feeling. Different time.</div>
        <div class="connection-thread">
          <div class="ct-entry">
            <div class="ct-year">${p.earlier.year}</div>
            <div class="ct-author">${esc(Data.getDisplayName(p.earlier.author_id))}</div>
            <div class="ct-quote">"${esc(p.earlier.note)}"</div>
          </div>
          <div class="ct-connector">
            <div class="ct-dot"></div>
            <div class="ct-vline"></div>
            <div class="ct-dot"></div>
          </div>
          <div class="ct-entry highlight">
            <div class="ct-year">${p.later.year}</div>
            <div class="ct-author">${esc(Data.getDisplayName(p.later.author_id))}</div>
            <div class="ct-quote">"${esc(p.later.note)}"</div>
          </div>
        </div>
        <div class="connection-footer">They never met. They're part of the same story now.</div>
      </div>`).join("");

    return `
      <section class="place-section">
        <div class="section-head">
          <h2>Connected Stories</h2>
          <p>Memories that met across time through a shared feeling.</p>
        </div>
        ${pairsHtml}
      </section>`;
  };

  // ---------- LEAVE TRACE BUTTON ----------
  const renderLeaveBtn = () => `
    <div class="place-leave-wrap">
      <button class="btn btn-primary btn-full" id="place-leave">✍️ Leave a trace here</button>
      <p class="leave-note">Your trace will be pinned to your exact GPS location and locked until someone walks here.</p>
    </div>`;

  // ---------- EVENTS ----------
  const bindEvents = () => {
    const leaveBtn = document.getElementById("place-leave");
    if (leaveBtn) leaveBtn.addEventListener("click", () => App.startLeave({ place: currentPlace }));

    const locateBtn = document.getElementById("prox-locate");
    if (locateBtn) locateBtn.addEventListener("click", async () => {
      UI.showToast("Finding your location…", false, true);
      try {
        const loc = await Geo.getCurrentPosition();
        Explore.setUserLocation(loc, false);
        UI.hideToast();
        render();
      } catch (e) {
        UI.hideToast();
        UI.showToast(e.message, true);
      }
    });

    document.querySelectorAll(".connect-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = currentMemories.find((x) => x.id === btn.dataset.id);
        if (!m) return;
        App.startLeave({
          place: currentPlace,
          reply: { id: m.id, author: Data.getDisplayName(m.author_id), preview: m.note, year: m.year }
        });
      });
    });
  };

  return { show, refresh };
})();