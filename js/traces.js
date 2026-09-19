const Traces = (() => {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const refresh = async () => {
    const user = Data.currentUser();
    const body = document.getElementById("traces-body");

    if (!user) {
      body.innerHTML = `
        <div class="dash-empty">
          <div class="dash-empty-icon">👣</div>
          <h2>Your traces live here</h2>
          <p>Sign in to see your capsules, storage, and your personal timeline.</p>
          <button class="btn btn-primary" id="traces-auth">Sign in</button>
        </div>`;
      document.getElementById("traces-auth").addEventListener("click", () => App.openAuthModal());
      return;
    }

    // Show loading skeleton
    body.innerHTML = `<div class="dash-loading">Loading your dashboard…</div>`;

    try {
      const [places, memories, links] = await Promise.all([
        Data.listPlaces(), Data.listMemories(), Data.listLinks()
      ]);

      const mine = memories.filter((m) => m.author_id === user.id)
        .sort((a, b) => a.year - b.year); // chronological for timeline
      const myPlaceIds = new Set(mine.map((m) => m.place_id));
      const myPlaces = places.filter((p) => myPlaceIds.has(p.id));
      const connected = links.filter((l) => l.author_id === user.id).length;

      // Storage data
      const used = Data.getStorageUsed();
      const limit = Data.getStorageLimit();
      const plan = Data.getCurrentPlan();
      const pct = Math.min(100, Math.round((used / limit) * 100));
      const planLabel = { free: "Freemium", explorer: "Explorer", legacy: "Legacy" }[plan] || "Freemium";
      const limitLabel = Data.fmtBytes(limit);
      const usedLabel = Data.fmtBytes(used);
      const storageColor = pct > 85 ? "#d6455d" : pct > 60 ? "#b98a00" : "#315efb";

      body.innerHTML = `
        <!-- STORAGE CARD -->
        <div class="dash-storage card">
          <div class="ds-top">
            <div>
              <div class="ds-plan">${planLabel} Plan</div>
              <div class="ds-label">${usedLabel} used of ${limitLabel}</div>
            </div>
            <button class="btn btn-primary btn-sm" id="dash-upgrade" ${plan === "legacy" ? "hidden" : ""}>Upgrade storage</button>
          </div>
          <div class="ds-bar-wrap">
            <div class="ds-bar" style="width:${pct}%; background:${storageColor}"></div>
          </div>
          <div class="ds-foot">${pct < 80 ? `${100 - pct}% free` : `<span style="color:${storageColor};font-weight:600">Running low — consider upgrading</span>`}</div>
        </div>

        <!-- STATS ROW -->
        <div class="dash-stats">
          <div class="ds-stat"><span class="ds-num">${mine.length}</span><span class="ds-lbl">capsules left</span></div>
          <div class="ds-stat"><span class="ds-num">${myPlaces.length}</span><span class="ds-lbl">places</span></div>
          <div class="ds-stat"><span class="ds-num">${connected}</span><span class="ds-lbl">connected</span></div>
          <div class="ds-stat"><span class="ds-num">${mine.filter(m => new Date(m.unlock_at) <= new Date()).length}</span><span class="ds-lbl">unlocked</span></div>
        </div>

        <!-- PERSONAL TIMELINE -->
        ${mine.length ? `
        <div class="dash-section">
          <div class="dash-sec-head">
            <h3>Your Timeline</h3>
            <p>Your capsule journey, oldest to newest.</p>
          </div>
          <div class="dash-timeline">
            ${mine.map((m, i) => {
              const place = places.find(p => p.id === m.place_id);
              const isOpen = new Date(m.unlock_at) <= new Date();
              const isLast = i === mine.length - 1;
              return `
                <div class="dt-item">
                  <div class="dt-spine">
                    <div class="dt-dot ${isOpen ? "open" : "sealed"}"></div>
                    ${!isLast ? `<div class="dt-line"></div>` : ""}
                  </div>
                  <div class="dt-body">
                    <div class="dt-meta">
                      <span class="dt-year">${m.year}</span>
                      <span class="dt-place">📍 ${esc(place ? place.name : "a place")}</span>
                      <span class="dt-badge ${isOpen ? "open" : "sealed"}">${isOpen ? "open" : "sealed"}</span>
                    </div>
                    ${isOpen
                      ? `<div class="dt-note">"${esc((m.note || "").slice(0, 120))}${(m.note || "").length > 120 ? "…" : ""}"</div>`
                      : `<div class="dt-locked">🔒 Sealed until ${new Date(m.unlock_at).getFullYear()}</div>`
                    }
                    <button class="btn btn-ghost btn-xs dt-view-btn" data-place="${m.place_id}">View place →</button>
                  </div>
                </div>`;
            }).join("")}
          </div>
        </div>` : `
        <div class="dash-section">
          <div class="dash-empty-inline">
            <p>You haven't left any capsules yet.</p>
            <button class="btn btn-primary" data-goto="explore">Go to the map →</button>
          </div>
        </div>`}

        <!-- PLACES YOU'VE BEEN -->
        ${myPlaces.length ? `
        <div class="dash-section">
          <div class="dash-sec-head">
            <h3>Places you've been</h3>
          </div>
          <div class="dash-places">
            ${myPlaces.map(p => `
              <button class="dash-place-btn" data-id="${p.id}">
                <span class="dp-name">📍 ${esc(p.name)}</span>
                <span class="dp-count">${mine.filter(m => m.place_id === p.id).length} capsule${mine.filter(m => m.place_id === p.id).length === 1 ? "" : "s"}</span>
              </button>`).join("")}
          </div>
        </div>` : ""}

        <!-- CTA: ADD MORE -->
        <div class="dash-cta">
          <button class="btn btn-primary" data-goto="explore">📍 Drop a new capsule</button>
        </div>`;

      // Bind events
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
      body.innerHTML = `<div class="dash-empty"><p>Could not load your dashboard.</p></div>`;
      UI.showToast(e.message, true);
    }
  };

  return { refresh };
})();