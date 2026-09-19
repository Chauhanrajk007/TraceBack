const Explore = (() => {
  let map = null;
  let layer = null;
  let userMarker = null;
  let userCircle = null;
  let pinMarker = null;
  let currentLocation = null;
  let capsules = [];
  const authorCache = {};

  let onMapPick = null;
  let locating = false;

  const init = async () => {
    map = L.map("map", { zoomControl: true }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    addTiles(map);
    layer = L.layerGroup().addTo(map);
    map.on("click", (e) => {
      if (onMapPick) onMapPick(e.latlng.lat, e.latlng.lng);
    });
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
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    const marker = L.marker([c.lat, c.lng], { icon });
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
        setUserLocation(loc);
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
    userMarker = L.circleMarker([loc.lat, loc.lng], {
      radius: 7,
      color: "#7cc7ff",
      fillColor: "#7cc7ff",
      fillOpacity: 1,
      weight: 2
    }).addTo(map);
    userCircle = L.circle([loc.lat, loc.lng], {
      radius: CONFIG.UNLOCK_RADIUS_METERS,
      color: "#7ee0a3",
      fillColor: "#7ee0a3",
      fillOpacity: 0.08,
      weight: 1
    }).addTo(map);
    if (fly) map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 15));
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
        html: `<div class="rtc-marker" style="width:38px;height:38px;font-size:19px;background:rgba(183,156,255,0.3);border-color:#b79cff">⏳</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      })
    }).addTo(map);
  };

  const clearPin = () => {
    if (pinMarker) pinMarker.remove();
    pinMarker = null;
  };

  const focusOn = (lat, lng, zoom = 15) => {
    if (map) map.setView([lat, lng], zoom);
  };

  const setPickMode = (enabled, handler) => {
    onMapPick = enabled ? handler || setPin : null;
    if (enabled && map) map.getContainer().style.cursor = "crosshair";
    if (!enabled && map) map.getContainer().style.cursor = "";
  };

  return {
    init,
    setCapsules,
    locateMe,
    setUserLocation,
    setPin,
    clearPin,
    focusOn,
    setPickMode,
    getMap: () => map,
    getLocation: () => currentLocation,
    refreshCapsules: setCapsules
  };
})();