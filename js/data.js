const Data = (() => {
  const LS_USERS = "rtc_users";
  const LS_SESSION = "rtc_session";
  const LS_CAPS = "rtc_capsules";

  let mode = "demo";
  let supabaseClient = null;
  let authListeners = [];

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));

  const nowIso = () => new Date().toISOString();

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  const notifyAuth = () => authListeners.forEach((cb) => cb(currentUser()));

  const registerDemo = (username, password) => {
    const users = load(LS_USERS, []);
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error("That username is already taken");
    }
    const user = { id: uid(), username, pass: btoa(unescape(encodeURIComponent(password))) };
    users.push(user);
    save(LS_USERS, users);
    save(LS_SESSION, user.id);
    return user;
  };

  const loginDemo = (username, password) => {
    const users = load(LS_USERS, []);
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user || user.pass !== btoa(unescape(encodeURIComponent(password)))) return null;
    save(LS_SESSION, user.id);
    return user;
  };

  const logoutDemo = () => localStorage.removeItem(LS_SESSION);

  const currentUserDemo = () => {
    const sessionId = load(LS_SESSION, null);
    if (!sessionId) return null;
    const users = load(LS_USERS, []);
    return users.find((u) => u.id === sessionId) || null;
  };

  const init = async () => {
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = window.supabase;
        supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        mode = "supabase";
        supabaseClient.auth.onAuthStateChange(() => notifyAuth());
      } catch {
        mode = "demo";
      }
    }
    return mode;
  };

  const isSupabase = () => mode === "supabase";

  const register = async (username, password) => {
    if (isSupabase()) {
      const email = username.includes("@") ? username : `${username}@timebottle.local`;
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      const user = { id: data.user.id, username: email };
      const { error: perr } = await supabaseClient.from("profiles").insert({ id: data.user.id, username: email });
      if (perr && !String(perr.message).includes("already exists")) throw new Error(perr.message);
      return user;
    }
    return registerDemo(username, password);
  };

  const login = async (username, password) => {
    if (isSupabase()) {
      const email = username.includes("@") ? username : `${username}@timebottle.local`;
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Wrong username or password");
      return { id: data.user.id, username: email };
    }
    const user = loginDemo(username, password);
    if (!user) throw new Error("Wrong username or password");
    return user;
  };

  const logout = async () => {
    if (isSupabase()) await supabaseClient.auth.signOut();
    else logoutDemo();
    notifyAuth();
  };

  const currentUser = () => {
    if (!isSupabase()) return currentUserDemo();
    const { data } = supabaseClient.auth.getSession();
    const session = data.session;
    return session ? { id: session.user.id, username: session.user.email } : null;
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
      author_id: payload.authorId,
      created_at: nowIso()
    };
    if (isSupabase()) {
      const { data, error } = await supabaseClient.from("capsules").insert(row).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const caps = load(LS_CAPS, []);
    row.id = uid();
    caps.push(row);
    save(LS_CAPS, caps);
    return row;
  };

  const listCapsules = async () => {
    if (isSupabase()) {
      const { data, error } = await supabaseClient.from("capsules").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }
    const caps = load(LS_CAPS, []);
    return [...caps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const myCapsules = async () => {
    const user = currentUser();
    if (!user) return [];
    const all = await listCapsules();
    return all.filter((c) => c.author_id === user.id);
  };

  const uploadFile = async (file, folder) => {
    if (!isSupabase()) return await toDataUrl(file);
    const path = `${folder}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data, error } = await supabaseClient.storage.from("capsule-media").upload(path, file, { upsert: false });
    if (error) throw new Error("Upload failed: " + error.message);
    const url = supabaseClient.storage.from("capsule-media").getPublicUrl(data.path).data.publicUrl;
    return url;
  };

  const deleteCapsule = async (id) => {
    if (isSupabase()) {
      const { error } = await supabaseClient.from("capsules").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    save(LS_CAPS, load(LS_CAPS, []).filter((c) => c.id !== id));
  };

  const saveProfile = async (updates) => {
    const user = currentUser();
    if (!isSupabase()) return user;
    const { error } = await supabaseClient.from("profiles").upsert({ id: user.id, ...updates });
    if (error) throw new Error(error.message);
    return user;
  };

  const getDisplayName = async (authorId) => {
    if (!isSupabase()) {
      const users = load(LS_USERS, []);
      const u = users.find((x) => x.id === authorId);
      return u ? u.username : "Anonymous";
    }
    const { data } = await supabaseClient.from("profiles").select("username").eq("id", authorId).maybeSingle();
    return data && data.username ? data.username : "Anonymous";
  };

  const getProfile = async () => {
    const user = currentUser();
    if (!user) return null;
    if (!isSupabase()) return { username: user.username };
    const { data } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data || { username: user.username };
  };

  const toDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const onAuth = (cb) => {
    authListeners.push(cb);
  };

  return {
    init,
    isSupabase,
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