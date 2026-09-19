const Trails = (() => {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const refresh = async () => {
    const container = document.getElementById("trails-body");
    if (!container) return;

    try {
      const journeys = Data.listJourneys();
      const places = await Data.listPlaces();

      let html = `
        <div class="trails-intro card">
          <div class="stub-icon">🧭</div>
          <h2>Follow someone through their life</h2>
          <p class="trails-sub">
            As a person moves on — <b>College → First workplace → A new city → A mountain</b> — each trace they leave becomes part of their Journey.
            Discover it one place at a time, the same way they lived it.
          </p>
        </div>`;

      for (const j of journeys) {
        html += `
          <div class="journey-card card">
            <div class="journey-head">
              <div class="journey-badge">Life Trail</div>
              <h3 class="journey-title">${esc(j.title)}</h3>
              <p class="journey-author">by <b>${esc(j.author)}</b> · 4 stops across 4 years</p>
              <p class="journey-desc">${esc(j.description)}</p>
            </div>

            <div class="journey-stops">`;

        j.stops.forEach((step, idx) => {
          const isLast = idx === j.stops.length - 1;
          const p = places.find((x) => x.id === step.placeId);
          html += `
            <div class="j-stop">
              <div class="j-stop-marker">
                <div class="j-num">${idx + 1}</div>
                ${!isLast ? `<div class="j-line"></div>` : ""}
              </div>
              <div class="j-stop-content card">
                <div class="j-stop-header">
                  <div class="j-place-name">📍 ${esc(step.placeName)}</div>
                  <span class="badge open">${step.year}</span>
                </div>
                ${step.spot ? `<div class="j-spot">${esc(step.spot)}</div>` : ""}
                <p class="j-note">"${esc(step.note)}"</p>
                ${step.clue ? `
                  <div class="j-clue">
                    <span>Next Clue:</span> "${esc(step.clue)}"
                  </div>` : ""}
                <div class="j-actions">
                  <button class="btn btn-primary btn-sm j-open-btn" data-place="${step.placeId}">
                    Discover Place
                  </button>
                  <button class="btn btn-ghost btn-sm j-map-btn" data-lat="${p ? p.lat : ""}" data-lng="${p ? p.lng : ""}">
                    Show on Map
                  </button>
                </div>
              </div>
            </div>`;
        });

        html += `
            </div>
          </div>`;
      }

      html += `
        <div class="journey-start card">
          <h3>Leave traces along your own path</h3>
          <p>Every memory you leave connects to the places you have walked. Over time, your traces form your own story trail for others to uncover.</p>
          <button class="btn btn-primary" id="trail-leave-btn">✍️ Leave a trace</button>
        </div>`;

      container.innerHTML = html;

      // Bind events
      container.querySelectorAll(".j-open-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = places.find((x) => x.id === btn.dataset.place);
          if (p) App.openPlace(p);
        });
      });

      container.querySelectorAll(".j-map-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const lat = parseFloat(btn.dataset.lat);
          const lng = parseFloat(btn.dataset.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            App.show("explore");
            Explore.focusOn(lat, lng, 14);
          }
        });
      });

      const startBtn = document.getElementById("trail-leave-btn");
      if (startBtn) {
        startBtn.addEventListener("click", () => App.startLeave({ fromHome: false }));
      }
    } catch (e) {
      UI.showToast(e.message, true);
    }
  };

  return { refresh };
})();
