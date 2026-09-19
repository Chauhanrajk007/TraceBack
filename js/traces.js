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
        <div class="card empty-place">
          <div class="stub-icon">👣</div>
          <p>Sign in to see the traces you've left and found.</p>
          <button class="btn btn-primary" id="traces-auth">Sign in</button>
        </div>`;
      document.getElementById("traces-auth").addEventListener("click", () => App.openAuthModal());
      return;
    }
    try {
      const [places, memories, links] = await Promise.all([Data.listPlaces(), Data.listMemories(), Data.listLinks()]);
      const mine = memories.filter((m) => m.author_id === user.id);
      const found = memories.filter((m) => m.author_id !== user.id && new Date(m.unlock_at).getTime() <= Date.now());
      const myPlaceIds = new Set(mine.map((m) => m.place_id));
      const myPlaces = places.filter((p) => myPlaceIds.has(p.id));
      const connected = links.filter((l) => l.author_id === user.id).length;

      body.innerHTML = `
        <div class="stats-row">
          <div class="stat card"><b>${mine.length}</b><span>left</span></div>
          <div class="stat card"><b>${found.length}</b><span>found</span></div>
          <div class="stat card"><b>${connected}</b><span>connected</span></div>
          <div class="stat card"><b>${myPlaces.length}</b><span>places</span></div>
        </div>

        <div class="card traces-places">
          <h3>Everywhere you've been</h3>
          ${myPlaces.length ? myPlaces.map((p) => `
            <button class="trace-place" data-id="${p.id}">📍 <b>${esc(p.name)}</b></button>`).join("") : "<p>You haven't left a trace anywhere yet.</p>"}
        </div>

        ${mine.length ? `
          <div class="card traces-list">
            <h3>Your traces</h3>
            ${mine.map((m) => {
              const p = places.find((x) => x.id === m.place_id);
              return `<div class="trace-row">
                <span class="badge ${new Date(m.unlock_at).getTime() <= Date.now() ? "open" : "sealed"}">${new Date(m.unlock_at).getTime() <= Date.now() ? "open" : "sealed"}</span>
                <span>${esc(p ? p.name : "somewhere")}</span>
                <span class="muted">${m.year} · ${esc((m.note || "").slice(0, 40))}${(m.note || "").length > 40 ? "…" : ""}</span>
              </div>`;
            }).join("")}
          </div>` : ""}

        ${found.length ? `
          <div class="card traces-list">
            <h3>Traces you can find now</h3>
            ${found.slice(0, 8).map((m) => {
              const p = places.find((x) => x.id === m.place_id);
              return `<button class="trace-row trace-find" data-place="${p ? p.id : ""}" data-lat="${m.lat}" data-lng="${m.lng}">
                <span class="badge open">open</span>
                <span>${esc(p ? p.name : "somewhere")}</span>
                <span class="muted">${m.year} · ${esc((m.note || "").slice(0, 40))}${(m.note || "").length > 40 ? "…" : ""}</span>
              </button>`;
            }).join("")}
          </div>` : ""}`;

      body.querySelectorAll("[data-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = places.find((p) => p.id === btn.dataset.id);
          if (p) App.openPlace(p);
        });
      });
      body.querySelectorAll(".trace-find").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = places.find((p) => p.id === btn.dataset.place);
          if (p) App.openPlace(p);
        });
      });
    } catch (e) {
      UI.showToast(e.message, true);
    }
  };

  return { refresh };
})();