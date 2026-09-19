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

  const getCurrentPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 0
          }),
        (err) => reject(new Error("Could not get your location: " + messageFor(err))),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
      );
    });

  const messageFor = (err) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return "location permission blocked";
      case err.POSITION_UNAVAILABLE:
        return "location unavailable";
      case err.TIMEOUT:
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