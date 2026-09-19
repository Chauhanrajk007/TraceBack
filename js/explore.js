const Explore = (() => {
  let map = null;
  let layer = null;
  let userMarker = null;
  let userCircle = null;
  let pinMarker = null;
  let currentLocation = null;
  let capsules = [];
  let onMapPick = null;
  let locating = false;
  const authorCache = {};

  const init = async () => {
    map = L.map("map", { zoomControl: true }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    addTiles(map);
    layer = L.layerGroup().addTo(map);
    map.on("click", (e) => {
      if (onMapPick) onMapPick(e.latlng.lat, e.latlng.lng);
    });
    L.control
      .zoom({ position: "bottomleft" })
      .addTo(map);
  };

  const resetView = () => {
    if (map) map.flyTo([CONFIG.MAP_CENTER[0], CONFIG.MAP_CENTER[1]], CONFIG.MAP_ZOOM, { duration: 0.6 });
  };

  const addTiles = (m) => {
    const primary = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    const fallback = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
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

  const getAuthor = async (id) => {
    if (authorCache[id]) return authorCache[id];
    authorCache[id] = await Data.getDisplayName(id);
    return authorCache[id];
  };

  const setCapsules = async (list) => {
    capsules = list;
    layer.clearLayers();
    if (userMarker) layer.addLayer(userMarker);
    if (userCircle) layer.addLayer(userCircle);
    for (const c of list) {
      const author = await getAuthor(c.author_id);
      addMarker(c, author);
    }
    updateCountBadge();
  };

  const isMine = (c) => {
    const user = Data.currentUser();
    return user && c.author_id === user.id;
  };

  const addMarker = (c, author) => {
    const opened = new Date(c.unlock_at).getTime() <= Date.now();
    const mine = isMine(c);
    const icon = L.divIcon({
      className: "rtc-icon",
      html: `<div class="rtc-marker ${opened ? "open" : "sealed"}">${opened ? "💌" : "🔒"}${mine ? '<span class="mine-tag"></span>' : ""}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    const marker = L.marker([c.lat, c.lng], { icon, title: c.title });
    const hint = mine
      ? `${c.title} (yours)`
      : opened
        ? `${c.title} — open`
        : `${c.title} — opens ${Geo.fmtDate(c.unlock_at)}`;
    marker.bindTooltip(hint, { direction: "top", offset: [0, -20], opacity: 0.95 });
    marker.bindPopup(
      `<div class="pop">
        <div class="pop-title">${c.title}</div>
        <div class="pop-meta">${opened ? "open" : "opens " + Geo.fmtDate(c.unlock_at)} &middot; by ${author}</div>
        <button class="btn btn-primary btn-sm" id="pop-open-${c.id}">${mine ? "Preview" : opened ? "Open" : "View"}</button>
      </div>`
    );
    marker.on("popupopen", () => {
      const btn = document.getElementById("pop-open-" + c.id);
      if (btn) btn.onclick = () => openCapsule(c, author);
    });
    layer.addLayer(marker);
  };

  const openCapsule = async (c, author) => {
    let loc = currentLocation;
    if (!loc) {
      try {
        loc = await Geo.getCurrentPosition();
        setUserLocation(loc, false);
      } catch {
        loc = null;
      }
    }
    UI.renderCapsuleView(c, loc, author);
  };

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
    if (btn) btn.disabled = true;
    try {
      const loc = await Geo.getCurrentPosition();
      setUserLocation(loc);
      UI.showToast("You're placed on the map");
    } catch (e) {
      UI.showToast(e.message, true);
    } finally {
      locating = false;
      if (btn) btn.disabled = false;
    }
  };

  const setPin = (lat, lng) => {
    if (!map) return;
    if (pinMarker) pinMarker.remove();
    pinMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "rtc-icon",
        html: `<div class="pin-marker">📍</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 34]
      })
    }).addTo(map);
  };

  const clearPin = () => {
    if (pinMarker) pinMarker.remove();
    pinMarker = null;
  };

  const focusOn = (lat, lng, zoom = 15) => {
    if (map) map.flyTo([lat, lng], zoom, { duration: 1 });
  };

  const setPickMode = (enabled, handler) => {
    onMapPick = enabled ? handler || setPin : null;
    if (enabled && map) map.getContainer().style.cursor = "crosshair";
    if (!enabled && map) map.getContainer().style.cursor = "";
  };

  const updateCountBadge = () => {
    const badge = document.getElementById("map-count");
    if (badge) {
      badge.hidden = false;
      badge.textContent = capsules.length === 0
        ? "nothing hidden here yet"
        : `${capsules.length} bottle${capsules.length === 1 ? "" : "s"} waiting on this map`;
    }
  };

  return {
    init,
    setCapsules,
    locateMe,
    setPin,
    clearPin,
    focusOn,
    resetView,
    setPickMode,
    refreshCapsules: setCapsules
  };
})();