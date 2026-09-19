const Explore = (() => {
  let map = null;
  let layer = null;
  let userMarker = null;
  let userCircle = null;
  let currentLocation = null;
  let locating = false;
  let onMapPick = null;
  let placesData = [];
  let memoriesData = [];
  let ready = false;

  const init = async () => {
    map = L.map("map", { zoomControl: false }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    addTiles(map);
    layer = L.layerGroup().addTo(map);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    ready = true;
  };

  const mapReady = () => ready;

  const resize = () => {
    if (map) setTimeout(() => map.invalidateSize(true), 50);
  };

  const resetView = () => {
    if (map) map.flyTo([CONFIG.MAP_CENTER[0], CONFIG.MAP_CENTER[1]], CONFIG.MAP_ZOOM, { duration: 0.6 });
  };

  const addTiles = (m) => {
    const primary = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    const fallback = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    });
    primary.addTo(m);
    let switched = false;
    primary.on("tileerror", () => {
      if (switched) return;
      switched = true;
      m.removeLayer(primary);
      fallback.addTo(m);
    });
  };

  // aggregate memories per place
  const stats = (placeId) => {
    const ms = memoriesData.filter((m) => m.place_id === placeId);
    const people = new Set(ms.map((m) => m.author_id)).size;
    const years = ms.map((m) => m.year);
    return {
      count: ms.length,
      people,
      years: years.length ? [Math.min(...years), Math.max(...years)] : [new Date().getFullYear(), new Date().getFullYear()]
    };
  };

  const setPlaces = (places, memories) => {
    placesData = places || [];
    memoriesData = memories || [];
    layer.clearLayers();
    if (userMarker) layer.addLayer(userMarker);
    if (userCircle) layer.addLayer(userCircle);

    for (const p of placesData) {
      const s = stats(p.id);
      addPlaceMarker(p, s);
    }
    updateChip();

    if (placesData.length && !currentLocation && map) {
      try {
        const bounds = L.latLngBounds(placesData.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } catch (_) {}
    }

    if (!placesData.length) {
      UI.showToast("No traces yet — be the first to leave one.", false);
    }
  };

  const addPlaceMarker = (p, s) => {
    const isNew = s.years[0] > new Date().getFullYear() - 5;
    const html = `<div class="place-pin">📍<span class="pin-count">${s.count}</span></div>`;
    const icon = L.divIcon({
      className: "rtc-icon",
      html,
      iconSize: isNew ? [48, 48] : [42, 42],
      iconAnchor: [24, 38]
    });

    const marker = L.marker([p.lat, p.lng], { icon });
    marker.bindTooltip(p.name, { direction: "top", offset: [0, -34], opacity: 0.95 });

    const yearRange = s.years[0] === s.years[1] ? `${s.years[0]}` : `${s.years[0]} → ${s.years[1]}`;
    const R = CONFIG.UNLOCK_RADIUS_METERS || 100;
    let lockLine;
    if (currentLocation) {
      const d = Geo.distanceMeters(p.lat, p.lng, currentLocation.lat, currentLocation.lng);
      lockLine = d <= R
        ? `<div class="pop-lock on">✨ You're here. Someone was here before you.</div>`
        : `<div class="pop-lock">📍 A trace is nearby — ${Math.round(d)} m away.<br /><small>Content unlocks within 50–100m.</small></div>`;
    } else {
      lockLine = `<div class="pop-lock">🔒 Content stays locked until you physically reach the 50–100m radius.</div>`;
    }
    const popHtml = `
      <div class="pop">
        <div class="pop-title">${p.name}</div>
        <div class="pop-meta">${s.people} ${s.people === 1 ? "person" : "people"} left traces here</div>
        <div class="pop-meta">${yearRange}</div>
        ${lockLine}
        <button class="btn btn-primary btn-sm" id="pop-open-${p.id}">Discover Place</button>
      </div>`;
    marker.bindPopup(popHtml, { maxWidth: 240 });
    marker.on("popupopen", () => {
      const btn = document.getElementById("pop-open-" + p.id);
      if (btn) btn.onclick = () => { App.openPlace(p); };
    });
    layer.addLayer(marker);
  };

  const updateChip = () => {
    const chip = document.getElementById("map-chip");
    if (!chip) return;
    const total = memoriesData.length;
    const people = new Set(memoriesData.map((m) => m.author_id)).size;
    chip.hidden = false;
    chip.textContent = total === 0
      ? "no traces here yet — leave the first"
      : `${total} trace${total === 1 ? "" : "s"} · ${people} ${people === 1 ? "place has" : "people have"} left traces`;
  };

  // --------- user location ---------
  const setUserLocation = (loc, fly = true) => {
    currentLocation = loc;
    if (!map) return;
    if (userMarker) { userMarker.remove(); userCircle.remove(); }
    userMarker = L.marker([loc.lat, loc.lng], {
      icon: L.divIcon({
        className: "user-icon",
        html: '<div class="user-dot"><span></span></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      }),
      zIndexOffset: 1000
    }).addTo(map);
    userCircle = L.circle([loc.lat, loc.lng], {
      radius: CONFIG.UNLOCK_RADIUS_METERS,
      color: "#3f9dff",
      fillColor: "#3f9dff",
      fillOpacity: 0.08,
      weight: 1,
      interactive: false
    }).addTo(map);
    if (fly) map.flyTo([loc.lat, loc.lng], Math.max(map.getZoom(), 15), { duration: 1.2 });
  };

  const locateMe = async () => {
    if (locating) return;
    locating = true;
    const btn = document.getElementById("locate-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Finding your location…";
    }
    UI.showToast("Finding your location… this can take a few seconds", false, true);
    try {
      const loc = await Geo.getCurrentPosition();
      setUserLocation(loc);
      UI.hideToast();
      UI.showToast("You're placed on the map");
    } catch (e) {
      UI.hideToast();
      UI.showToast(e.message, true);
    } finally {
      locating = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "◎ My location";
      }
    }
  };

  const getLocation = () => currentLocation;

  // --------- pick mode (used by Leave) ---------
  const setPickMode = (enabled, handler) => {
    onMapPick = enabled ? handler : null;
    const banner = document.getElementById("pick-banner");
    if (banner) banner.hidden = !enabled;
    if (map) map.getContainer().style.cursor = enabled ? "crosshair" : "";
    if (enabled) {
      map.on("click", pickHandler);
    } else {
      map.off("click", pickHandler);
    }
  };

  const pickHandler = (e) => {
    if (!onMapPick) return;
    onMapPick(e.latlng.lat, e.latlng.lng);
  };

  const focusOn = (lat, lng, zoom = 15) => {
    if (map) map.flyTo([lat, lng], zoom, { duration: 1 });
  };

  return {
    init,
    mapReady,
    resize,
    resetView,
    setPlaces,
    locateMe,
    getLocation,
    setUserLocation,
    setPickMode,
    focusOn
  };
})();