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

  // ---------- default rich seed data ----------
  const DEFAULT_PROFILES = {
    "p1": "Aarav",
    "p2": "Priya",
    "p3": "Rohan",
    "p4": "Meera",
    "p5": "Kabir"
  };

  const DEFAULT_PLACES = [
    {
      id: "place-college",
      name: "The College Campus",
      category: "College",
      lat: 12.9716,
      lng: 77.5946,
      spots: ["Library", "Cafeteria", "Classroom", "Ground", "Hostel", "A favorite bench"],
      then_now: {
        thenYear: 2023,
        thenNote: "This area used to be empty open ground where we kicked footballs until sunset.",
        thenPhoto: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80",
        nowYear: 2026,
        nowNote: "There's a modern humanities building here now, but the stone bench behind the trees is still the same.",
        nowPhoto: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80"
      },
      created_at: "2023-01-01T00:00:00Z"
    },
    {
      id: "place-work",
      name: "First Workplace Studio",
      category: "Workplace",
      lat: 12.9352,
      lng: 77.6245,
      spots: ["Quiet Balcony", "Stairwell", "Lobby"],
      then_now: {
        thenYear: 2024,
        thenNote: "An unfinished brick loft with bare bulbs and cardboard desks.",
        thenPhoto: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
        nowYear: 2026,
        nowNote: "Glass partitions and monitors humming all night.",
        nowPhoto: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80"
      },
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "place-cafe",
      name: "Oldtown Corner Café",
      category: "Café",
      lat: 12.9780,
      lng: 77.6408,
      spots: ["Table 4 by the window", "Outdoor bench", "Counter"],
      then_now: {
        thenYear: 2024,
        thenNote: "Wobbly corner wooden table, handwritten chalkboard menu with filter roast.",
        thenPhoto: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
        nowYear: 2026,
        nowNote: "They painted the window cobalt blue, but Table 4 still has the exact same groove carved into the sill.",
        nowPhoto: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"
      },
      created_at: "2024-02-01T00:00:00Z"
    },
    {
      id: "place-mountain",
      name: "Sunset Mountain Ridge",
      category: "Mountain",
      lat: 13.3702,
      lng: 77.6835,
      spots: ["Summit Rock", "Ridge overlook", "Pine trail"],
      then_now: {
        thenYear: 2022,
        thenNote: "Faint dirt scramble through thick brambles.",
        thenPhoto: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
        nowYear: 2026,
        nowNote: "A weathered wooden railing now marks the edge, looking into pure morning clouds.",
        nowPhoto: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80"
      },
      created_at: "2022-06-01T00:00:00Z"
    }
  ];

  const DEFAULT_MEMORIES = [
    {
      id: "mem-col-1",
      place_id: "place-college",
      author_id: "p1",
      year: 2023,
      spot: "Library Steps",
      note: "First day here. Didn't know anyone. Sat on the library steps watching everyone walk in pairs, wondering if I'd ever feel like I belonged.",
      unlock_at: "2023-08-01T00:00:00Z",
      lat: 12.9716,
      lng: 77.5946,
      photo_url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80",
      created_at: "2023-08-01T00:00:00Z"
    },
    {
      id: "mem-col-2",
      place_id: "place-college",
      author_id: "p2",
      year: 2024,
      spot: "Cafeteria Terrace",
      note: "Finally found my people. We bought two plates of hot samosas and ended up talking about everything and nothing until the watchman asked us to leave.",
      unlock_at: "2024-03-15T00:00:00Z",
      lat: 12.9718,
      lng: 77.5948,
      photo_url: null,
      created_at: "2024-03-15T00:00:00Z"
    },
    {
      id: "mem-col-3",
      place_id: "place-college",
      author_id: "p3",
      year: 2024,
      spot: "A Favorite Bench",
      note: "I used to sit here after class and think about what I wanted to do with my life. The sky turns violet between these two neem branches.",
      unlock_at: "2024-10-10T00:00:00Z",
      lat: 12.9715,
      lng: 77.5944,
      photo_url: null,
      created_at: "2024-10-10T00:00:00Z"
    },
    {
      id: "mem-col-4",
      place_id: "place-college",
      author_id: "p4",
      year: 2025,
      spot: "Hostel Lawn",
      note: "Graduating soon. Can't believe it's already over. Packed my bags three times just to unpack them again. How did four years fit into an afternoon?",
      unlock_at: "2025-05-20T00:00:00Z",
      lat: 12.9720,
      lng: 77.5950,
      photo_url: null,
      created_at: "2025-05-20T00:00:00Z"
    },
    {
      id: "mem-col-5",
      place_id: "place-college",
      author_id: "p5",
      year: 2026,
      spot: "Library Steps",
      note: "I'm reading this as a junior. I wonder what this place will be like when I graduate. The steps are still cold in the early morning breeze.",
      unlock_at: "2026-01-10T00:00:00Z",
      lat: 12.9716,
      lng: 77.5946,
      photo_url: null,
      created_at: "2026-01-10T00:00:00Z"
    },
    {
      id: "mem-col-6",
      place_id: "place-college",
      author_id: "p5",
      year: 2026,
      spot: "A Favorite Bench",
      note: "That's exactly why I came here. I still sit here thinking about the same thing — looking at that same violet sky through the neem leaves.",
      unlock_at: "2026-02-14T00:00:00Z",
      lat: 12.9715,
      lng: 77.5944,
      photo_url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80",
      created_at: "2026-02-14T00:00:00Z"
    },
    // Journey memories for Aarav
    {
      id: "mem-work-1",
      place_id: "place-work",
      author_id: "p1",
      year: 2024,
      spot: "Quiet Balcony",
      note: "First day at work. Kept adjusting my collar in the elevator mirror. Terrified of failing, but somehow made it through.",
      unlock_at: "2024-07-01T00:00:00Z",
      lat: 12.9352,
      lng: 77.6245,
      photo_url: null,
      clue: "The next trace is somewhere I used to go on rainy afternoons when I needed to think.",
      created_at: "2024-07-01T00:00:00Z"
    },
    {
      id: "mem-cafe-1",
      place_id: "place-cafe",
      author_id: "p1",
      year: 2025,
      spot: "Table 4 by the window",
      note: "Rain drumming against the glass. Table 4. Realized today that growing up doesn't mean knowing all the answers — just learning to sit with the questions.",
      unlock_at: "2025-09-12T00:00:00Z",
      lat: 12.9780,
      lng: 77.6408,
      photo_url: null,
      clue: "The final trace is somewhere high above the noise, where you can see the whole horizon at sunrise.",
      created_at: "2025-09-12T00:00:00Z"
    },
    {
      id: "mem-mtn-1",
      place_id: "place-mountain",
      author_id: "p1",
      year: 2026,
      spot: "Summit Rock",
      note: "Stood here at sunrise. Four years after walking into college terrified, looking at the entire valley below. Whoever you are standing here next — you'll make it through.",
      unlock_at: "2026-03-01T00:00:00Z",
      lat: 13.3702,
      lng: 77.6835,
      photo_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
      created_at: "2026-03-01T00:00:00Z"
    }
  ];

  const DEFAULT_LINKS = [
    {
      id: "link-1",
      from_memory_id: "mem-col-6",
      to_memory_id: "mem-col-3",
      author_id: "p5",
      created_at: "2026-02-14T00:00:00Z"
    }
  ];

  const DEFAULT_JOURNEYS = [
    {
      id: "journey-aarav",
      title: "Aarav's Journey: Growing Up & Moving On",
      author_id: "p1",
      author: "Aarav",
      description: "From the college library steps to the mountain ridge at sunrise — traces left across four formative years.",
      stops: [
        {
          placeId: "place-college",
          placeName: "The College Campus",
          year: 2023,
          spot: "Library Steps",
          memoryId: "mem-col-1",
          note: "First day here. Didn't know anyone.",
          clue: "The next trace is where I took my first real leap into the working world."
        },
        {
          placeId: "place-work",
          placeName: "First Workplace Studio",
          year: 2024,
          spot: "Quiet Balcony",
          memoryId: "mem-work-1",
          note: "First job, first paycheck, terrified and excited on day one.",
          clue: "The next trace is somewhere I used to go on rainy afternoons when I needed to think."
        },
        {
          placeId: "place-cafe",
          placeName: "Oldtown Corner Café",
          year: 2025,
          spot: "Table 4 by the window",
          memoryId: "mem-cafe-1",
          note: "Rain drumming against the glass. Table 4.",
          clue: "The final trace is somewhere high above the city noise, where you can see the whole horizon."
        },
        {
          placeId: "place-mountain",
          placeName: "Sunset Mountain Ridge",
          year: 2026,
          spot: "Summit Rock",
          memoryId: "mem-mtn-1",
          note: "Stood here at sunrise. Looking at the valley below. You'll make it through.",
          clue: null
        }
      ]
    }
  ];

  const LOCAL_PLACES_KEY = "rtc_local_places";
  const LOCAL_MEMORIES_KEY = "rtc_local_memories";
  const LOCAL_LINKS_KEY = "rtc_local_links";

  const getLocalItems = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (_) {
      return [];
    }
  };

  const saveLocalItem = (key, item) => {
    try {
      const items = getLocalItems(key);
      items.unshift(item);
      localStorage.setItem(key, JSON.stringify(items));
    } catch (_) {}
  };

  const getDisplayName = (authorId) => {
    return profileCache[authorId] || DEFAULT_PROFILES[authorId] || "Someone";
  };

  const loadProfiles = async () => {
    Object.assign(profileCache, DEFAULT_PROFILES);
    if (!supabaseClient) return profileCache;
    try {
      const { data, error } = await supabaseClient.from("profiles").select("id, username");
      if (!error && data) {
        data.forEach((p) => (profileCache[p.id] = p.username));
      }
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
    DEFAULT_PLACES.forEach((p) => map.set(p.id, p));
    local.forEach((p) => map.set(p.id, p));
    remote.forEach((p) => map.set(p.id, { ...map.get(p.id), ...p }));
    return Array.from(map.values());
  };

  const createPlace = async (name, lat, lng, spots = []) => {
    const newPlace = {
      id: uid(),
      name,
      lat,
      lng,
      spots: spots.length ? spots : ["Main Area"],
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
    const local = getLocalItems(LOCAL_MEMORIES_KEY);
    let remote = [];
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from("memories").select("*").order("created_at", { ascending: false });
        if (!error && data) remote = data;
      } catch (_) {}
    }
    const map = new Map();
    DEFAULT_MEMORIES.forEach((m) => map.set(m.id, m));
    local.forEach((m) => map.set(m.id, m));
    remote.forEach((m) => map.set(m.id, { ...map.get(m.id), ...m }));
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at || b.unlock_at) - new Date(a.created_at || a.unlock_at));
  };

  const listMemoriesForPlace = async (placeId) => {
    const all = await listMemories();
    return all
      .filter((m) => m.place_id === placeId)
      .sort((a, b) => b.year - a.year || new Date(b.created_at || 0) - new Date(a.created_at || 0));
  };

  const addMemory = async (payload) => {
    const user = currentUser();
    const authorId = user ? user.id : (payload.authorId || "guest-" + uid());
    const authorName = user ? user.username : (payload.authorName || "You");
    profileCache[authorId] = authorName;

    const row = {
      id: uid(),
      place_id: payload.placeId,
      author_id: authorId,
      note: payload.note || "",
      spot: payload.spot || "Here",
      lat: payload.lat,
      lng: payload.lng,
      year: payload.year || new Date().getFullYear(),
      unlock_at: new Date(payload.unlockAt || Date.now()).toISOString(),
      photo_url: payload.photo || null,
      clue: payload.clue || null,
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

  // ---------- links / connected stories ----------
  const addLink = async (fromMemoryId, toMemoryId) => {
    const user = currentUser();
    const authorId = user ? user.id : "user-" + uid();
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
    DEFAULT_LINKS.forEach((l) => map.set(l.id, l));
    local.forEach((l) => map.set(l.id, l));
    remote.forEach((l) => map.set(l.id, l));
    return Array.from(map.values());
  };

  const listJourneys = () => DEFAULT_JOURNEYS;

  // ---------- uploads ----------
  const uploadFile = async (file, folder) => {
    if (supabaseClient) {
      try {
        const path = `${folder}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { data, error } = await supabaseClient.storage.from("capsule-media").upload(path, file, { upsert: false });
        if (!error && data) {
          return supabaseClient.storage.from("capsule-media").getPublicUrl(data.path).data.publicUrl;
        }
      } catch (_) {}
    }
    // local preview data url fallback so user uploads always work
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
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
    listJourneys,
    uploadFile
  };
})();