const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "js", "config.js");

const loadEnv = () => {
  const envFile = path.join(ROOT, ".env");
  const parsed = {};
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m || m[1].startsWith("#")) continue;
      parsed[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return parsed;
};

const env = loadEnv();
const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "").trim();
const radius = Number(process.env.UNLOCK_RADIUS_METERS || env.UNLOCK_RADIUS_METERS) || 100;

const detectRole = (jwt) => {
  try {
    const seg = jwt.split(".")[1];
    return JSON.parse(Buffer.from(seg, "base64").toString("utf8")).role || null;
  } catch {
    return null;
  }
};

if (key && detectRole(key) === "service_role") {
  console.error("Refusing to write a service_role key into client config. Use the anon key.");
  process.exit(1);
}

const content = `const CONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
  UNLOCK_RADIUS_METERS: ${radius},
  PLACE_RADIUS_METERS: ${radius},
  MAP_CENTER: [20.5937, 78.9629],
  MAP_ZOOM: 5
};`;

fs.writeFileSync(OUT, content, "utf8");
console.log(
  `Generated js/config.js (${url ? "online mode, radius " + radius + "m" : "local demo mode"})`
);