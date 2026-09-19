const Place = (() => {
  let currentPlace = null;
  let currentMemories = [];
  let allLinks = [];
  let selectedYear = "all";

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const radius = () => CONFIG.UNLOCK_RADIUS_METERS || 100;

  // A memory is readable ONLY when its unlock date has passed AND the user is within 50-100m — or it's yours
  const readable = (m) => {
    const user = Data.currentUser();
    const mine = user && m.author_id === user.id;
    if (mine) return { canOpen: true, opened: true, mine: true };
    const opened = new Date(m.unlock_at).getTime() <= Date.now();
    if (!opened) return { canOpen: false, opened: false, mine: false };
    const loc = Explore.getLocation();
    if (!loc) return { canOpen: false, opened: true, mine: false, dist: null };
    const dist = Geo.distanceMeters(m.lat, m.lng, loc.lat, loc.lng);
    return { canOpen: dist <= radius(), opened: true, mine: false, dist };
  };

  const show = async (place) => {
    currentPlace = place;
    selectedYear = "all";
    App.show("place");
    Place.refresh();
    Explore.resize();
  };

  const refresh = async () => {
    try {
      currentMemories = await Data.listMemoriesForPlace(currentPlace.id);
      try {
        allLinks = await Data.listLinks();
      } catch (_) {
        allLinks = [];
      }
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

  // ---------- Proximity Banner (50–100m Core Feature) ----------
  const renderProximity = () => {
    const R = radius();
    const d = placeDistance();

    if (d == null) {
      return `
        <div class="prox wait">
          <div class="px-ico">📍</div>
          <div class="px-body">
            <b>A trace is here — locked to this spot.</b>
            <span>Nothing opens remotely. Content stays locked until you physically reach the 50–100 m radius.</span>
            <div class="px-actions">
              <button class="btn btn-primary btn-sm" id="prox-locate">◎ Find my location</button>
              <button class="btn btn-ghost btn-sm" id="prox-sim-in">🚶 Walk here (Simulate within 50m)</button>
            </div>
          </div>
        </div>`;
    }

    if (d <= R) {
      return `
        <div class="prox on">
          <div class="px-ico">✨</div>
          <div class="px-body">
            <b>You're here. Someone was here before you.</b>
            <span>You are within ${Math.round(d)} m (under the ${R} m radius). Their memories and photos are unlocked where they once stood.</span>
            <div class="px-actions">
              <button class="btn btn-ghost btn-sm" id="prox-sim-out">🚶 Step outside (Simulate walking away)</button>
              <button class="btn btn-ghost btn-sm" id="prox-locate">◎ Refresh GPS</button>
            </div>
          </div>
        </div>`;
    }

    const distText = d <= 500 ? `${Math.round(d)} m` : Geo.fmtDistance(d);
    const nearbyHeadline = d <= 300
      ? `A trace is nearby — ${Math.round(d)} m away.`
      : `You're ${distText} away.`;

    return `
      <div class="prox off">
        <div class="px-ico">🔒</div>
        <div class="px-body">
          <b>${nearbyHeadline}</b>
          <span>Content stays locked until you physically reach the 50–100 meter radius. Your feet have to do the walking.</span>
          <div class="px-actions">
            <button class="btn btn-primary btn-sm" id="prox-sim-in">🚶 Walk here (Simulate within 50m)</button>
            <button class="btn btn-ghost btn-sm" id="prox-locate">◎ Refresh GPS</button>
          </div>
        </div>
      </div>`;
  };

  // ---------- Year Timeline Bar ----------
  const renderTimelineBar = () => {
    const years = [...new Set(currentMemories.map((m) => m.year))].sort((a, b) => a - b);
    if (!years.length) return "";

    const quotes = {
      2023: "First day here. Didn't know anyone.",
      2024: "Finally found my people.",
      2025: "Graduating soon. Can't believe it's already over.",
      2026: "I'm reading this as a junior. I wonder what this place will be like when I graduate."
    };

    const pills = years.map((y) => {
      const q = quotes[y] || "";
      const active = selectedYear === String(y) ? "active" : "";
      return `
        <button class="tl-pill ${active}" data-year="${y}">
          <span class="tl-year">${y}</span>
          ${q ? `<span class="tl-q">"${esc(q)}"</span>` : ""}
        </button>`;
    }).join(`<div class="tl-arrow">→</div>`);

    return `
      <div class="timeline-bar-wrap card">
        <div class="timeline-bar-head">
          <span class="tl-title">Years Walked Here</span>
          <button class="btn-link ${selectedYear === "all" ? "active" : ""}" id="tl-show-all">Show all years</button>
        </div>
        <div class="timeline-pills">${pills}</div>
      </div>`;
  };

  // ---------- SECTION 1: PEOPLE ----------
  const renderPeopleSection = () => {
    const peopleMap = new Map();
    currentMemories.forEach((m) => {
      const p = peopleMap.get(m.author_id) || {
        authorId: m.author_id,
        name: Data.getDisplayName(m.author_id),
        years: new Set(),
        spots: new Set(),
        traces: 0
      };
      p.years.add(m.year);
      if (m.spot) p.spots.add(m.spot);
      p.traces++;
      peopleMap.set(m.author_id, p);
    });

    const peopleList = Array.from(peopleMap.values());
    if (!peopleList.length) return "";

    const cards = peopleList.map((p) => {
      const yrs = Array.from(p.years).sort((a, b) => a - b).join(" · ");
      const spotTags = Array.from(p.spots).slice(0, 2).map((s) => `<span class="spot-pill">${esc(s)}</span>`).join("");
      const initial = (p.name || "S")[0].toUpperCase();
      return `
        <div class="person-card card">
          <div class="person-avatar">${esc(initial)}</div>
          <div class="person-info">
            <div class="person-name">${esc(p.name)}</div>
            <div class="person-meta">${p.traces} trace${p.traces === 1 ? "" : "s"} · ${yrs}</div>
            <div class="person-spots">${spotTags}</div>
          </div>
        </div>`;
    }).join("");

    return `
      <section class="place-sec" id="sec-people">
        <div class="sec-head">
          <h3>People</h3>
          <p>Who left traces here before you.</p>
        </div>
        <div class="people-grid">${cards}</div>
      </section>`;
  };

  // ---------- SECTION 2: STORIES ----------
  const renderStoriesSection = () => {
    let list = currentMemories;
    if (selectedYear !== "all") {
      list = list.filter((m) => String(m.year) === selectedYear);
    }

    if (!list.length) {
      return `
        <section class="place-sec" id="sec-stories">
          <div class="sec-head">
            <h3>Stories</h3>
            <p>Their memories.</p>
          </div>
          <div class="card empty-place">
            <p>No traces recorded for ${selectedYear}.</p>
          </div>
        </section>`;
    }

    const cards = list.map((m) => memoryCard(m)).join("");

    return `
      <section class="place-sec" id="sec-stories">
        <div class="sec-head">
          <h3>Stories</h3>
          <p>Their memories — unlocked when you stand where they stood.</p>
        </div>
        <div class="stories-list">${cards}</div>
      </section>`;
  };

  const memoryCard = (m) => {
    const st = readable(m);
    const author = Data.getDisplayName(m.author_id);
    const spot = m.spot ? `<span class="mem-spot">📍 ${esc(m.spot)}</span>` : "";

    let body;
    if (st.canOpen) {
      body = `
        <div class="memory-note">${esc(m.note || "— no words. the silence says enough —")}</div>
        ${m.photo_url ? `<img class="memory-photo" src="${m.photo_url}" alt="memory photo" />` : ""}
        ${m.clue ? `<div class="memory-clue">🧭 <b>Journey Clue:</b> <em>"${esc(m.clue)}"</em></div>` : ""}
        <div class="connect-action-box">
          <button class="btn btn-primary btn-sm connect-story-btn" data-reply="${m.id}">
            🤝 Connect These Stories
          </button>
          <span class="connect-sub">Felt the same way? Connect your memory to theirs — two people, same spot, different years.</span>
        </div>`;
    } else if (st.opened) {
      const dist = st.dist != null
        ? `A trace is nearby — ${Math.round(st.dist)} m away.`
        : "Share location to unlock — you have to reach this spot.";
      body = `
        <div class="memory-locked">
          <div class="seal">🔒</div>
          <div class="lock-copy">
            <b>${dist}</b>
            <span>Content stays locked until you physically walk within ${radius()} m of this spot.</span>
          </div>
        </div>`;
    } else {
      const d = Geo.daysUntil(m.unlock_at);
      body = `
        <div class="memory-locked">
          <div class="seal">⏳</div>
          <div class="lock-copy">
            <b>This trace stays sealed until ${Geo.fmtDate(m.unlock_at)}</b>
            <span>Opens in ${d} day${d === 1 ? "" : "s"}. Come back when its time arrives.</span>
          </div>
        </div>`;
    }

    return `
      <div class="memory card ${st.canOpen ? "is-open" : "is-sealed"}">
        <div class="memory-head">
          <div class="mem-author-box">
            <span class="author">${esc(author)}</span>
            <span class="mem-year">${m.year}</span>
            ${spot}
          </div>
          <span class="badge ${st.canOpen ? "open" : "sealed"}">
            ${st.mine ? "yours" : st.canOpen ? "unlocked" : "locked (proximity)"}
          </span>
        </div>
        ${body}
      </div>`;
  };

  // ---------- SECTION 3: THEN → NOW ----------
  const renderThenNowSection = () => {
    const tn = currentPlace.then_now;
    if (!tn) return "";

    return `
      <section class="place-sec" id="sec-then-now">
        <div class="sec-head">
          <h3>Then → Now</h3>
          <p>How this place has changed over time.</p>
        </div>
        <div class="thennow-card card">
          <div class="tn-grid">
            <div class="tn-col then">
              <div class="tn-badge">Then · ${tn.thenYear}</div>
              ${tn.thenPhoto ? `<img class="tn-img" src="${tn.thenPhoto}" alt="Then photo" />` : ""}
              <p class="tn-quote">"${esc(tn.thenNote)}"</p>
            </div>
            <div class="tn-divider">
              <div class="tn-arrow">➜</div>
              <span>Years passed</span>
            </div>
            <div class="tn-col now">
              <div class="tn-badge now">Now · ${tn.nowYear}</div>
              ${tn.nowPhoto ? `<img class="tn-img" src="${tn.nowPhoto}" alt="Now photo" />` : ""}
              <p class="tn-quote">"${esc(tn.nowNote)}"</p>
            </div>
          </div>
          <div class="tn-foot">The people change. The place changes. The memories remain.</div>
        </div>
      </section>`;
  };

  // ---------- SECTION 4: CONNECTED STORIES ----------
  const renderConnectedSection = () => {
    // Find paired memories linked together
    const links = allLinks || [];
    const placeMemIds = new Set(currentMemories.map((m) => m.id));

    const connectedPairs = [];
    links.forEach((l) => {
      const fromMem = currentMemories.find((m) => m.id === l.from_memory_id);
      const toMem = currentMemories.find((m) => m.id === l.to_memory_id);
      if (fromMem && toMem) {
        connectedPairs.push({ from: fromMem, to: toMem });
      }
    });

    // If none from DB links yet, check if we have the classic 2024 / 2026 mindset pair
    if (!connectedPairs.length) {
      const rohan = currentMemories.find((m) => m.year === 2024 && (m.note || "").includes("what I wanted to do"));
      const kabir = currentMemories.find((m) => m.year === 2026 && (m.note || "").includes("That's exactly why"));
      if (rohan && kabir) {
        connectedPairs.push({ from: kabir, to: rohan });
      }
    }

    if (!connectedPairs.length) return "";

    const pairsHtml = connectedPairs.map((pair) => {
      const earler = pair.to.year <= pair.from.year ? pair.to : pair.from;
      const later = pair.to.year <= pair.from.year ? pair.from : pair.to;

      return `
        <div class="connected-thread card">
          <div class="ct-header">
            <span class="ct-badge">✨ Same place. Same feeling. Different time.</span>
            <span class="ct-span">${earler.year} → ${later.year}</span>
          </div>

          <div class="ct-cards">
            <div class="ct-card">
              <div class="ct-author-row">
                <b>${esc(Data.getDisplayName(earler.author_id))}</b>
                <span>${earler.year}</span>
              </div>
              <p class="ct-quote">"${esc(earler.note)}"</p>
            </div>

            <div class="ct-link-icon">
              <div class="ct-line"></div>
              <span>Connected</span>
              <div class="ct-line"></div>
            </div>

            <div class="ct-card highlight">
              <div class="ct-author-row">
                <b>${esc(Data.getDisplayName(later.author_id))}</b>
                <span>${later.year}</span>
              </div>
              <p class="ct-quote">"${esc(later.note)}"</p>
            </div>
          </div>
          <div class="ct-footer">
            Now they are part of the same story.
          </div>
        </div>`;
    }).join("");

    return `
      <section class="place-sec" id="sec-connected">
        <div class="sec-head">
          <h3>Connected Stories</h3>
          <p>Memories that met across time through a shared feeling.</p>
        </div>
        <div class="connected-list">${pairsHtml}</div>
      </section>`;
  };

  // ---------- Master Render ----------
  const render = () => {
    const body = document.getElementById("place-body");
    const ms = currentMemories;
    const people = new Set(ms.map((m) => m.author_id)).size;
    const years = ms.length ? [Math.min(...ms.map((m) => m.year)), Math.max(...ms.map((m) => m.year))] : null;

    const spotsList = currentPlace.spots && currentPlace.spots.length
      ? `<div class="college-spots">${currentPlace.spots.map((s) => `<span>${esc(s)}</span>`).join("")}</div>`
      : "";

    const head = `
      <div class="place-head">
        <h1 class="place-name">${esc(currentPlace.name)}</h1>
        <p class="place-tag">People were here before you.</p>
        ${spotsList}
        <div class="place-meta">
          ${people} ${people === 1 ? "person" : "people"} left traces here
          ${years ? (years[0] === years[1] ? ` · ${years[0]}` : ` · ${years[0]} → ${years[1]}`) : ""}
        </div>
        <button class="btn btn-primary" id="place-leave">✍️ Leave a trace here</button>
      </div>`;

    body.innerHTML =
      head +
      renderProximity() +
      renderTimelineBar() +
      renderPeopleSection() +
      renderStoriesSection() +
      renderThenNowSection() +
      renderConnectedSection();

    bindEvents();
  };

  const bindEvents = () => {
    const leaveBtn = document.getElementById("place-leave");
    if (leaveBtn) {
      leaveBtn.addEventListener("click", () => App.startLeave({ place: currentPlace, fromPlace: true }));
    }

    const locateBtn = document.getElementById("prox-locate");
    if (locateBtn) locateBtn.addEventListener("click", onLocate);

    const simInBtn = document.getElementById("prox-sim-in");
    if (simInBtn) simInBtn.addEventListener("click", onSimulateArriving);

    const simOutBtn = document.getElementById("prox-sim-out");
    if (simOutBtn) simOutBtn.addEventListener("click", onSimulateLeaving);

    const showAllBtn = document.getElementById("tl-show-all");
    if (showAllBtn) {
      showAllBtn.addEventListener("click", () => {
        selectedYear = "all";
        render();
      });
    }

    document.querySelectorAll(".tl-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedYear = btn.dataset.year;
        render();
        const sec = document.getElementById("sec-stories");
        if (sec) sec.scrollIntoView({ behavior: "smooth" });
      });
    });

    document.querySelectorAll(".connect-story-btn").forEach((btn) => {
      btn.addEventListener("click", () => onReply(btn.dataset.reply));
    });
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

  // Simulate entering within 50m of the place
  const onSimulateArriving = () => {
    // set location roughly 30m away from currentPlace
    const lat = currentPlace.lat + 0.0002;
    const lng = currentPlace.lng + 0.0002;
    Explore.setUserLocation({ lat, lng, accuracy: 10 });
    UI.showToast("You've arrived within 50m of " + currentPlace.name);
    refresh();
  };

  // Simulate walking 400m away
  const onSimulateLeaving = () => {
    const lat = currentPlace.lat + 0.004;
    const lng = currentPlace.lng + 0.004;
    Explore.setUserLocation({ lat, lng, accuracy: 25 });
    UI.showToast("You walked outside the unlock radius.");
    refresh();
  };

  const onReply = (memoryId) => {
    const m = currentMemories.find((x) => x.id === memoryId);
    if (!m) return;
    App.startLeave({
      place: currentPlace,
      fromPlace: true,
      reply: { id: m.id, author: Data.getDisplayName(m.author_id), preview: m.note, year: m.year }
    });
  };

  return { show, refresh, onSimulateArriving, onSimulateLeaving };
})();