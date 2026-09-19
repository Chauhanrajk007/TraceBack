const Traces = (() => {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const refresh = async () => {
    const user = Data.currentUser();
    const body = document.getElementById("traces-body");
    if (!body) return;

    // Show loading indicator
    body.innerHTML = `<div class="dash-loading">Loading your personal dashboard…</div>`;

    try {
      const [places, memories, links] = await Promise.all([
        Data.listPlaces(), Data.listMemories(), Data.listLinks()
      ]);

      // If user is logged in, show their remote+local memories.
      // If guest, show their local memories created on this device.
      let mine = [];
      if (user) {
        mine = memories.filter((m) => m.author_id === user.id);
      } else {
        const local = Data.getLocalMemories ? Data.getLocalMemories() : [];
        mine = local.length ? local : memories.filter((m) => String(m.author_id).startsWith("guest-") || String(m.id).startsWith("local-"));
      }

      // Sort chronological (oldest to newest) for timeline
      mine.sort((a, b) => (a.year || 0) - (b.year || 0) || new Date(a.created_at || 0) - new Date(b.created_at || 0));

      const myPlaceIds = new Set(mine.map((m) => m.place_id));
      const myPlaces = places.filter((p) => myPlaceIds.has(p.id));
      const connected = user ? links.filter((l) => l.author_id === user.id).length : 0;
      const unlockedCount = mine.filter((m) => new Date(m.unlock_at || 0) <= new Date()).length;

      // Storage calculation
      const used = Data.getStorageUsed();
      const limit = Data.getStorageLimit(); // 500MB free, 5GB explorer, 50GB legacy
      const plan = Data.getCurrentPlan();
      const pct = Math.min(100, Math.round((used / limit) * 100));
      const planLabel = { free: "Freemium", explorer: "Explorer", legacy: "Legacy" }[plan] || "Freemium";
      const limitLabel = Data.fmtBytes(limit);
      const usedLabel = Data.fmtBytes(used);
      const storageColor = pct > 85 ? "#d6455d" : pct > 60 ? "#b98a00" : "#315efb";

      body.innerHTML = `
        <!-- USER / GUEST STATUS -->
        <div class="dash-user-bar ${user ? 'is-user' : 'is-guest'}">
          ${user ? `
            <div class="dub-info">
              <span class="dub-badge">✓ Active</span>
              <span class="dub-text">Signed in as <b>${esc(user.username)}</b></span>
            </div>
          ` : `
            <div class="dub-info">
              <span class="dub-badge guest">Guest Mode</span>
              <span class="dub-text">Capsules are saved on this browser.</span>
            </div>
            <button class="btn btn-ghost btn-sm" id="dash-signin-btn">Sign in to sync</button>
          `}
        </div>

        <!-- STORAGE CARD -->
        <div class="dash-storage card">
          <div class="ds-top">
            <div>
              <div class="ds-plan">${planLabel} Plan</div>
              <div class="ds-label">${usedLabel} used of ${limitLabel}</div>
            </div>
            <button class="btn btn-primary btn-sm" id="dash-upgrade" ${plan === "legacy" ? "hidden" : ""}>Upgrade Storage</button>
          </div>
          <div class="ds-bar-wrap">
            <div class="ds-bar" style="width:${Math.max(pct, 2)}%; background:${storageColor}"></div>
          </div>
          <div class="ds-foot">${pct < 85 ? `${100 - pct}% storage free` : `<span style="color:${storageColor};font-weight:600">Storage almost full — upgrade for more space</span>`}</div>
        </div>

        <!-- STATS ROW -->
        <div class="dash-stats">
          <div class="ds-stat"><span class="ds-num">${mine.length}</span><span class="ds-lbl">Capsules Left</span></div>
          <div class="ds-stat"><span class="ds-num">${myPlaces.length}</span><span class="ds-lbl">Places</span></div>
          <div class="ds-stat"><span class="ds-num">${connected}</span><span class="ds-lbl">Connected</span></div>
          <div class="ds-stat"><span class="ds-num">${unlockedCount}</span><span class="ds-lbl">Unlocked</span></div>
        </div>

        <!-- PERSONAL TIMELINE -->
        <div class="dash-section">
          <div class="dash-sec-head">
            <h3>Your Personal Timeline</h3>
            <p>Every capsule you've left across time, chronological order.</p>
          </div>

          ${mine.length ? `
          <div class="dash-timeline">
            ${mine.map((m, i) => {
              const place = places.find(p => p.id === m.place_id);
              const isOpen = new Date(m.unlock_at || 0) <= new Date();
              const isLast = i === mine.length - 1;
              const unlockYear = new Date(m.unlock_at || 0).getFullYear();
              return `
                <div class="dt-item">
                  <div class="dt-spine">
                    <div class="dt-dot ${isOpen ? "open" : "sealed"}"></div>
                    ${!isLast ? `<div class="dt-line"></div>` : ""}
                  </div>
                  <div class="dt-body">
                    <div class="dt-meta">
                      <span class="dt-year">${m.year || new Date().getFullYear()}</span>
                      <span class="dt-place">📍 ${esc(place ? place.name : "This spot")}</span>
                      <span class="dt-badge ${isOpen ? "open" : "sealed"}">${isOpen ? "unlocked" : "sealed"}</span>
                    </div>
                    ${isOpen
                      ? `<div class="dt-note">"${esc((m.note || "").slice(0, 140))}${(m.note || "").length > 140 ? "…" : ""}"</div>`
                      : `<div class="dt-locked">🔒 Sealed — unlocks around <b>${unlockYear}</b> within 100m</div>`
                    }
                    ${m.photo_url ? `<div class="dt-has-photo">📷 Includes photo</div>` : ""}
                    ${place ? `<button class="btn btn-ghost btn-xs dt-view-btn" data-place="${place.id}">View spot on map →</button>` : ""}
                  </div>
                </div>`;
            }).join("")}
          </div>` : `
          <div class="dash-empty-inline">
            <div class="dei-icon">⏳</div>
            <p><b>No capsules left yet.</b><br />Stand somewhere special and drop a capsule for the future.</p>
            <button class="btn btn-primary" data-goto="explore">📍 Open Map &amp; Drop Capsule</button>
          </div>`}
        </div>

        <!-- PLACES YOU'VE BEEN -->
        ${myPlaces.length ? `
        <div class="dash-section">
          <div class="dash-sec-head">
            <h3>Places you've pinned</h3>
          </div>
          <div class="dash-places">
            ${myPlaces.map(p => `
              <button class="dash-place-btn" data-id="${p.id}">
                <span class="dp-name">📍 ${esc(p.name)}</span>
                <span class="dp-count">${mine.filter(m => m.place_id === p.id).length} capsule${mine.filter(m => m.place_id === p.id).length === 1 ? "" : "s"}</span>
              </button>`).join("")}
          </div>
        </div>` : ""}

        <!-- ACTION CTA -->
        <div class="dash-cta">
          <button class="btn btn-primary btn-lg" data-goto="explore">📍 Drop a Capsule on the Map</button>
        </div>`;

      // Bind events inside dashboard
      const signinBtn = body.querySelector("#dash-signin-btn");
      if (signinBtn) signinBtn.addEventListener("click", () => App.openAuthModal());

      const upgradeBtn = body.querySelector("#dash-upgrade");
      if (upgradeBtn) upgradeBtn.addEventListener("click", () => UI.openModal("modal-plans"));

      body.querySelectorAll(".dt-view-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const p = places.find(x => x.id === btn.dataset.place);
          if (p) App.openPlace(p);
        });
      });

      body.querySelectorAll(".dash-place-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const p = places.find(x => x.id === btn.dataset.id);
          if (p) App.openPlace(p);
        });
      });

    } catch (e) {
      body.innerHTML = `
        <div class="dash-empty">
          <p>Could not load dashboard: ${esc(e.message)}</p>
          <button class="btn btn-primary" data-goto="explore">Go to Map</button>
        </div>`;
    }
  };

  return { refresh };
})();