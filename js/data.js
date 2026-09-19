const Data = (() => {
  let supabaseClient = null;
  let authListeners = [];
  let cachedSession = null;

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));

  const notifyAuth = () => authListeners.forEach((cb) => cb(currentUser()));

  const init = async () => {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY first.");
    }
    const { createClient } = window.supabase;
    if (!createClient) throw new Error("Supabase JS library failed to load (check network).");
    supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const { data } = await supabaseClient.auth.getSession();
    cachedSession = (data && data.session) || null;
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
      notifyAuth();
    });
  };

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
    notifyAuth();
  };

  const currentUser = () =>
    cachedSession ? { id: cachedSession.user.id, username: cachedSession.user.email } : null;

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

  const myCapsules = async () => {
    const user = currentUser();
    if (!user) return [];
    const all = await listCapsules();
    return all.filter((c) => c.author_id === user.id);
  };

  const uploadFile = async (file, folder) => {
    const path = `${folder}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data, error } = await supabaseClient.storage.from("capsule-media").upload(path, file, { upsert: false });
    if (error) throw new Error("Upload failed: " + error.message);
    return supabaseClient.storage.from("capsule-media").getPublicUrl(data.path).data.publicUrl;
  };

  const deleteCapsule = async (id) => {
    const { error } = await supabaseClient.from("capsules").delete().eq("id", id);
    if (error) throw new Error(error.message);
  };

  const saveProfile = async (updates) => {
    const user = currentUser();
    if (!user) throw new Error("Not signed in");
    const { error } = await supabaseClient.from("profiles").upsert({ id: user.id, ...updates });
    if (error) throw new Error(error.message);
    return user;
  };

  const getDisplayName = async (authorId) => {
    const { data } = await supabaseClient.from("profiles").select("username").eq("id", authorId).maybeSingle();
    return data && data.username ? data.username : "Anonymous";
  };

  const getProfile = async () => {
    const user = currentUser();
    if (!user) return null;
    const { data } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data || { username: user.username };
  };

  const onAuth = (cb) => {
    authListeners.push(cb);
  };

  return {
    init,
    register,
    login,
    logout,
    currentUser,
    addCapsule,
    listCapsules,
    myCapsules,
    uploadFile,
    deleteCapsule,
    saveProfile,
    getProfile,
    getDisplayName,
    onAuth
  };
})();