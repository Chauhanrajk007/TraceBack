const Data = (() => {
  let supabaseClient = null;
  let cachedSession = null;
  let lastSignup = null;
  const profileCache = {};

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));

  const init = async () => {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY first.");
    }
    const { createClient } = window.supabase;
    if (!createClient) throw new Error("Supabase JS library failed to load (check network).");
    supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
    });
    try {
      const { data } = await supabaseClient.auth.getSession();
      cachedSession = (data && data.session) || null;
    } catch {
      cachedSession = null;
    }
    purgeSeedData();
  };

  const purgeSeedData = () => {
    try {
      ["rtc_local_places", "rtc_local_memories", "rtc_local_links"].forEach((k) => {
        const arr = getLocalItems(k).filter((x) => !String(x.id).startsWith("seed-") && x.place_id !== "seed-place-1");
        localStorage.setItem(k, JSON.stringify(arr));
      });
    } catch (_) {}
  };

  const currentUser = () =>
    cachedSession ? { id: cachedSession.user.id, username: cachedSession.user.email } : null;

  const authMessage = (msg) => {
    const m = String(msg || "").toLowerCase();
    if (m.includes("email not confirmed")) return "Check your email and confirm your account first, then sign in.";
    if (m.includes("invalid login credentials")) return "Wrong email or password.";
    if (m.includes("already registered")) return "That email is already registered. Try signing in.";
    if (m.includes("rate limit")) return "Too many attempts — wait a moment and try again.";
    if (m.includes("fetch") || m.includes("network") || m.includes("connection")) return "Can't reach the server — check your internet connection and try again.";
    return msg || "Something went wrong.";
  };

  const register = async (username, password) => {
    const email = username.includes("@") ? username : `${username}@timebottle.local`;
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { username }, emailRedirectTo: window.location.origin }
    });
    if (error) throw new Error(authMessage(error.message));
    if (!data.user) throw new Error("Could not create account");
    if (!data.session) {
      lastSignup = { email, password, username };
      return { id: data.user.id, username: email, needsConfirmation: true };
    }
    cachedSession = data.session;
    await ensureProfile(data.user.id, username);
    return { id: data.user.id, username: email, needsConfirmation: false };
  };

  const resendConfirmation = async () => {
    if (!lastSignup) throw new Error("No pending signup found");
    const { error } = await supabaseClient.auth.resend({
      type: "signup",
      email: lastSignup.email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw new Error(authMessage(error.message));
  };

  const completeSignup = async () => {
    if (!lastSignup) throw new Error("Please sign up first");
    return await login(lastSignup.username, lastSignup.password);
  };

  const ensureProfile = async (id, username) => {
    const { error } = await supabaseClient
      .from("profiles")
      .upsert({ id, username }, { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error && !/already exists|duplicate/i.test(error.message)) {
      console.warn("profile upsert skipped:", error.message);
    }
  };

  const login = async (username, password) => {
    const email = username.includes("@") ? username : `${username}@timebottle.local`;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw new Error(authMessage(error.message));
    if (!data.session) throw new Error("Sign in succeeded but no session returned");
    cachedSession = data.session;
    return { id: data.user.id, username: email };
  };

  const logout = async () => {
    cachedSession = null;
    await supabaseClient.auth.signOut();
  };

  // ---------- localStorage fallback ----------
  const LOCAL_PLACES_KEY = "rtc_local_places";
  const LOCAL_MEMORIES_KEY = "rtc_local_memories";
  const LOCAL_LINKS_KEY = "rtc_local_links";

  const getLocalItems = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { return []; }
  };
  const getLocalMemories = () => getLocalItems(LOCAL_MEMORIES_KEY);

  const saveLocalItem = (key, item) => {
    try {
      const items = getLocalItems(key);
      items.unshift(item);
      localStorage.setItem(key, JSON.stringify(items));
    } catch (_) {}
  };

  // ---------- profiles ----------
  const getDisplayName = (authorId) =>
    profileCache[authorId] || "Someone";

  const loadProfiles = async () => {
    if (!supabaseClient) return profileCache;
    try {
      const { data, error } = await supabaseClient.from("profiles").select("id, username");
      if (!error && data) data.forEach((p) => (profileCache[p.id] = p.username));
    } catch (_) {}
    return profileCache;
  };

  // ---------- places ----------
  const listPlaces = async () => {
    const local = getLocalItems(LOCAL_PLACES_KEY);
    let remote = [];
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from("places").select("*").order("created_at", { ascending: false });
        if (!error && data) remote = data;
      } catch (_) {}
    }
    const map = new Map();
    local.forEach((p) => map.set(p.id, p));
    remote.forEach((p) => map.set(p.id, { ...map.get(p.id), ...p }));
    return Array.from(map.values());
  };

  const createPlace = async (name, lat, lng) => {
    const newPlace = {
      id: uid(),
      name,
      lat,
      lng,
      created_at: new Date().toISOString()
    };
    saveLocalItem(LOCAL_PLACES_KEY, newPlace);
    if (supabaseClient && currentUser()) {
      try {
        const { data, error } = await supabaseClient.from("places").insert({ name, lat, lng }).select().single();
        if (!error && data) return data;
      } catch (_) {}
    }
    return newPlace;
  };

  const findPlaceNear = (places, lat, lng) => {
    let closest = null, closestDist = Infinity;
    for (const p of places) {
      if (!isFinite(p.lat) || !isFinite(p.lng)) continue;
      const d = Geo.distanceMeters(p.lat, p.lng, lat, lng);
      if (d < closestDist) { closestDist = d; closest = p; }
    }
    const R = CONFIG.PLACE_RADIUS_METERS || CONFIG.UNLOCK_RADIUS_METERS || 100;
    return closest && closestDist <= R ? closest : null;
  };

  // ---------- memories ----------
  const listMemories = async () => {
    const local = getLocalItems(LOCAL_MEMORIES_KEY);
    let remote = [];
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from("memories").select("*").order("created_at", { ascending: false });
        if (!error && data) remote = data;
      } catch (_) {}
    }
    const map = new Map();
    local.forEach((m) => map.set(m.id, m));
    remote.forEach((m) => map.set(m.id, { ...map.get(m.id), ...m }));
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.created_at || b.unlock_at) - new Date(a.created_at || a.unlock_at)
    );
  };

  const listMemoriesForPlace = async (placeId) => {
    const all = await listMemories();
    return all
      .filter((m) => m.place_id === placeId)
      .sort((a, b) => a.year - b.year || new Date(a.created_at || 0) - new Date(b.created_at || 0));
  };

  const addMemory = async (payload) => {
    const user = currentUser();
    const authorId = user ? user.id : ("guest-" + uid());
    const authorName = user ? user.username : "You";
    profileCache[authorId] = authorName;

    const row = {
      id: uid(),
      place_id: payload.placeId,
      author_id: authorId,
      note: payload.note || "",
      lat: payload.lat,
      lng: payload.lng,
      year: payload.year || new Date().getFullYear(),
      unlock_at: new Date(payload.unlockAt || Date.now()).toISOString(),
      photo_url: payload.photo || null,
      created_at: new Date().toISOString()
    };

    saveLocalItem(LOCAL_MEMORIES_KEY, row);

    if (supabaseClient && user) {
      try {
        const { data, error } = await supabaseClient.from("memories").insert({
          place_id: row.place_id,
          author_id: row.author_id,
          note: row.note,
          lat: row.lat,
          lng: row.lng,
          year: row.year,
          unlock_at: row.unlock_at,
          photo_url: row.photo_url
        }).select().single();
        if (!error && data) return data;
      } catch (_) {}
    }
    return row;
  };

  // ---------- links ----------
  const addLink = async (fromMemoryId, toMemoryId) => {
    const user = currentUser();
    const authorId = user ? user.id : ("user-" + uid());
    const link = {
      id: uid(),
      from_memory_id: fromMemoryId,
      to_memory_id: toMemoryId,
      author_id: authorId,
      created_at: new Date().toISOString()
    };
    saveLocalItem(LOCAL_LINKS_KEY, link);
    if (supabaseClient && user) {
      try {
        await supabaseClient.from("links").insert({
          from_memory_id: fromMemoryId,
          to_memory_id: toMemoryId,
          author_id: authorId
        });
      } catch (_) {}
    }
    return link;
  };

  const listLinks = async () => {
    const local = getLocalItems(LOCAL_LINKS_KEY);
    let remote = [];
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from("links").select("*");
        if (!error && data) remote = data;
      } catch (_) {}
    }
    const map = new Map();
    local.forEach((l) => map.set(l.id, l));
    remote.forEach((l) => map.set(l.id, l));
    return Array.from(map.values());
  };

  // ---------- storage tracking ----------
  const STORAGE_KEY = "rtc_storage_used_bytes";
  // Plan limits in bytes  (free = 500 MB)
  const STORAGE_LIMITS = { free: 500 * 1024 * 1024, explorer: 5 * 1024 * 1024 * 1024, legacy: 50 * 1024 * 1024 * 1024 };
  const PLAN_KEY = "rtc_plan"; // "free" | "explorer" | "legacy"

  const getStorageUsed = () => {
    try { return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10); } catch { return 0; }
  };

  const getStorageLimit = () => {
    const plan = localStorage.getItem(PLAN_KEY) || "free";
    return STORAGE_LIMITS[plan] || STORAGE_LIMITS.free;
  };

  const getCurrentPlan = () => localStorage.getItem(PLAN_KEY) || "free";

  const setPlan = (plan) => localStorage.setItem(PLAN_KEY, plan);

  const addStorageUsed = (bytes) => {
    try {
      const cur = getStorageUsed();
      localStorage.setItem(STORAGE_KEY, String(cur + bytes));
    } catch (_) {}
  };

  const fmtBytes = (b) => {
    if (b >= 1024 * 1024 * 1024) return (b / (1024 * 1024 * 1024)).toFixed(1) + " GB";
    if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
    if (b >= 1024) return (b / 1024).toFixed(0) + " KB";
    return b + " B";
  };

  const checkStorageFor = (file) => {
    const used = getStorageUsed();
    const limit = getStorageLimit();
    if (used + file.size > limit) {
      return { ok: false, used, limit, needed: file.size };
    }
    return { ok: true, used, limit };
  };

  // ---------- uploads (with storage tracking) ----------
  const uploadFile = async (file, folder) => {
    if (supabaseClient) {
      try {
        const path = `${folder}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { data, error } = await supabaseClient.storage.from("capsule-media").upload(path, file, { upsert: false });
        if (!error && data) {
          addStorageUsed(file.size);
          return supabaseClient.storage.from("capsule-media").getPublicUrl(data.path).data.publicUrl;
        }
      } catch (_) {}
    }
    // local preview fallback
    addStorageUsed(file.size);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  };

  return {
    init, register, resendConfirmation, completeSignup, login, logout,
    currentUser, loadProfiles, getDisplayName,
    listPlaces, createPlace, findPlaceNear,
    listMemories, listMemoriesForPlace, addMemory,
    addLink, listLinks,
    uploadFile,
    getStorageUsed, getStorageLimit, getCurrentPlan, setPlan, fmtBytes, checkStorageFor,
    getLocalMemories
  };
})();