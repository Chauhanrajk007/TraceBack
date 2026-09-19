const Data = (() => {
  let supabaseClient = null;
  let cachedSession = null;

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));

  const init = async () => {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY first.");
    }
    const { createClient } = window.supabase;
    if (!createClient) throw new Error("Supabase JS library failed to load (check network).");
    supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const { data } = await supabaseClient.auth.getSession();
    cachedSession = (data && data.session) || null;
    // keep the session in sync after login/logout/token refresh
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
    });
  };

  const currentUser = () =>
    cachedSession ? { id: cachedSession.user.id, username: cachedSession.user.email } : null;

  const register = async (username, password) => {
    const email = username.includes("@") ? username : `${username}@timebottle.local`;
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    const user = { id: data.user.id, username: email };
    const { error: perr } = await supabaseClient.from("profiles").insert({ id: data.user.id, username: email });
    if (perr && !String(perr.message).includes("already exists")) throw new Error(perr.message);
    return user;
  };

  const login = async (username, password) => {
    const email = username.includes("@") ? username : `${username}@timebottle.local`;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Wrong username or password");
    return { id: data.user.id, username: email };
  };

  const logout = async () => {
    await supabaseClient.auth.signOut();
  };

  const addCapsule = async (payload) => {
    const row = {
      lat: payload.lat,
      lng: payload.lng,
      title: payload.title,
      note: payload.note || "",
      photo_url: payload.photo || null,
      audio_url: payload.audio || null,
      unlock_at: new Date(payload.unlockAt).toISOString(),
      author_id: payload.authorId
    };
    const { data, error } = await supabaseClient.from("capsules").insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  };

  const listCapsules = async () => {
    const { data, error } = await supabaseClient.from("capsules").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  };

  const uploadFile = async (file, folder) => {
    const path = `${folder}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data, error } = await supabaseClient.storage.from("capsule-media").upload(path, file, { upsert: false });
    if (error) throw new Error("Upload failed: " + error.message);
    return supabaseClient.storage.from("capsule-media").getPublicUrl(data.path).data.publicUrl;
  };

  const getDisplayName = async (authorId) => {
    const { data } = await supabaseClient.from("profiles").select("username").eq("id", authorId).maybeSingle();
    return data && data.username ? data.username : "Anonymous";
  };

  return {
    init,
    register,
    login,
    logout,
    currentUser,
    addCapsule,
    listCapsules,
    uploadFile,
    getDisplayName
  };
})();