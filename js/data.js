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
    // keep the session in sync after login/logout/token refresh
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
    });
    // Don't let a slow network block the whole app — restore session if one exists.
    try {
      const { data } = await supabaseClient.auth.getSession();
      cachedSession = (data && data.session) || null;
    } catch {
      cachedSession = null;
    }
  };

  const currentUser = () =>
    cachedSession ? { id: cachedSession.user.id, username: cachedSession.user.email } : null;

  const authMessage = (msg) => {
    const m = String(msg || "").toLowerCase();
    if (m.includes("email not confirmed")) return "Check your email and confirm your account first, then sign in.";
    if (m.includes("invalid login credentials")) return "Wrong email or password.";
    if (m.includes("already registered")) return "That email is already registered. Try signing in.";
    if (m.includes("rate limit")) return "Too many attempts — wait a moment and try again.";
    if (m.includes("security key")) return "Security keys are not supported here — use email + password.";
    if (m.includes("fetch") || m.includes("network") || m.includes("connection")) return "Can't reach the server — check your internet connection and try again.";
    return msg || "Something went wrong.";
  };

  const apiMessage = (msg) => {
    const m = String(msg || "").toLowerCase();
    if (m.includes("fetch") || m.includes("network") || m.includes("connection")) {
      return "Can't reach the server — check your internet connection.";
    }
    return msg || "Something went wrong.";
  };

  const register = async (username, password) => {
    const email = username.includes("@") ? username : `${username}@timebottle.local`;
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw new Error(authMessage(error.message));
    const needsConfirmation = !data.session;
    if (needsConfirmation) {
      lastSignup = { email, password, username };
      return { id: data.user.id, username: email, needsConfirmation: true };
    }
    await ensureProfile(data.user.id, username, email);
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
    return { id: data.user.id, username: email };
  };

  const logout = async () => {
    await supabaseClient.auth.signOut();
  };

  const getDisplayName = (authorId) => {
    return profileCache[authorId] || "Someone";
  };

  const loadProfiles = async () => {
    const { data, error } = await supabaseClient.from("profiles").select("id, username");
    if (error) throw new Error(apiMessage(error.message));
    (data || []).forEach((p) => (profileCache[p.id] = p.username));
    return profileCache;
  };

  // ---------- places ----------
  const listPlaces = async () => {
    const { data, error } = await supabaseClient.from("places").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(apiMessage(error.message));
    return data || [];
  };

  const createPlace = async (name, lat, lng) => {
    const { data, error } = await supabaseClient.from("places").insert({ name, lat, lng }).select().single();
    if (error) throw new Error(apiMessage(error.message));
    return data;
  };

  // find a place within the GPS-radius of a coordinate, else null
  const findPlaceNear = (places, lat, lng) => {
    let closest = null;
    let closestDist = Infinity;
    for (const p of places) {
      const d = Geo.distanceMeters(p.lat, p.lng, lat, lng);
      if (d < closestDist) {
        closestDist = d;
        closest = p;
      }
    }
    return closest && closestDist <= (CONFIG.PLACE_RADIUS_METERS || CONFIG.UNLOCK_RADIUS_METERS) ? closest : null;
  };

  // ---------- memories ----------
  const listMemories = async () => {
    const { data, error } = await supabaseClient.from("memories").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(apiMessage(error.message));
    return data || [];
  };

  const listMemoriesForPlace = async (placeId) => {
    const { data, error } = await supabaseClient
      .from("memories")
      .select("*")
      .eq("place_id", placeId)
      .order("year", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(apiMessage(error.message));
    return data || [];
  };

  const addMemory = async (payload) => {
    const user = currentUser();
    if (!user) throw new Error("Please sign in first.");
    const row = {
      place_id: payload.placeId,
      author_id: user.id,
      note: payload.note || "",
      lat: payload.lat,
      lng: payload.lng,
      year: payload.year,
      unlock_at: new Date(payload.unlockAt).toISOString(),
      photo_url: payload.photo || null
    };
    const { data, error } = await supabaseClient.from("memories").insert(row).select().single();
    if (error) throw new Error(apiMessage(error.message));
    return data;
  };

  // ---------- links / trails ----------
  const addLink = async (fromMemoryId, toMemoryId) => {
    const user = currentUser();
    if (!user) throw new Error("Please sign in first.");
    const { data, error } = await supabaseClient.from("links").insert({
      from_memory_id: fromMemoryId,
      to_memory_id: toMemoryId,
      author_id: user.id
    }).select().single();
    if (error) throw new Error(apiMessage(error.message));
    return data;
  };

  const listLinks = async () => {
    const { data, error } = await supabaseClient.from("links").select("*");
    if (error) throw new Error(apiMessage(error.message));
    return data || [];
  };

  // ---------- uploads ----------
  const uploadFile = async (file, folder) => {
    const path = `${folder}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data, error } = await supabaseClient.storage.from("capsule-media").upload(path, file, { upsert: false });
    if (error) throw new Error("Upload failed: " + error.message);
    return supabaseClient.storage.from("capsule-media").getPublicUrl(data.path).data.publicUrl;
  };

  return {
    init,
    register,
    resendConfirmation,
    completeSignup,
    login,
    logout,
    currentUser,
    loadProfiles,
    getDisplayName,
    listPlaces,
    createPlace,
    findPlaceNear,
    listMemories,
    listMemoriesForPlace,
    addMemory,
    addLink,
    listLinks,
    uploadFile
  };
})();