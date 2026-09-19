const Geo = (() => {
  const toRad = (d) => (d * Math.PI) / 180;

  const distanceMeters = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const locate = (opts) =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 0
          }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0, ...opts }
      );
    });

  const getCurrentPosition = async () => {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by this browser");
    }
    // Single high-accuracy attempt — never fall back to low-accuracy tower/WiFi
    // so we never return a random-seeming coarse location.
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || 0 }),
        (err) => reject(new Error("Could not get your location: " + messageFor(err))),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    });
  };

  const messageFor = (err) => {
    switch (err && err.code) {
      case 1:
        return "location permission blocked";
      case 2:
        return "location unavailable";
      case 3:
        return "location request timed out";
      default:
        return "unknown error";
    }
  };

  const fmtDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  const daysUntil = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));

  return { distanceMeters, getCurrentPosition, fmtDistance, fmtDate, daysUntil };
})();