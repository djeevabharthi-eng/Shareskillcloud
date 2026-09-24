import express from "express";
import path from "path";
import fs from "node:fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import type { 
  UserProfile, 
  ExchangeRequest, 
  ChatMessage, 
  UserProgress, 
  SkillItem,
  LearningGoal,
  WebRTCSignal,
  MessageMediaType,
  SkillExchangeSession,
  SessionStatus,
  SessionFeedback,
  ActivityItem,
  RecommendedPartner
} from "./src/types.ts";

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      user: UserProfile;
    }
  }
}

// Demo/seed data is OFF by default so only real Supabase accounts appear.
const SEED_DEMO = process.env.SEED_DEMO_DATA === "true";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ztoxgqzpizbruegitgpd.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_0-yfYSxRRHOJwIS5t61cPA_N7rPinpc";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Ensure environment variables from AI Studio runtime (/app/.dev.env.json) are loaded into process.env
try {
  const devEnvPath = path.join(process.cwd(), "..", ".dev.env.json");
  if (fs.existsSync(devEnvPath)) {
    const raw = fs.readFileSync(devEnvPath, "utf-8");
    const jsonEnv = JSON.parse(raw);
    for (const [k, v] of Object.entries(jsonEnv)) {
      if (!process.env[k] && typeof v === "string") {
        process.env[k] = v;
      }
    }
  }
} catch (_) {}

let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    try {
      genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("Could not initialize Gemini client:", e);
    }
  }
  return genAIClient;
}

// In-Memory Database initialized with actual data from the reference video
const SEED_USERS: UserProfile[] = [
  {
    id: "user-jeeva",
    name: "Jeeva bharathi D",
    email: "jeeva@shareskill.cloud",
    city: "Thanjavur",
    country: "India",
    bio: "I know python basics but I want to learn about web development basics. I am an 3rd year student",
    avatarUrl: "",
    teachSkills: [
      { id: "s-t-1", name: "Python basic", category: "Programming", level: "Beginner" },
    ],
    learnSkills: [
      { id: "s-l-1", name: "Web development", category: "Programming", level: "Intermediate" },
    ],
    availability: "Flexible / anytime",
    locationPreference: "Online"
  },
  {
    id: "user-darksoul",
    name: "Darksoul",
    email: "darksoul@shareskill.cloud",
    city: "Chennai",
    country: "India",
    bio: "Full-stack web engineer enthusiastic about algorithms and python.",
    avatarUrl: "",
    teachSkills: [
      { id: "s-t-2", name: "Web development", category: "Programming", level: "Expert" }
    ],
    learnSkills: [
      { id: "s-l-2", name: "Python", category: "Programming", level: "Intermediate" }
    ],
    availability: "Flexible / anytime",
    locationPreference: "Online"
  },
  {
    id: "user-karthik",
    name: "Karthik R",
    email: "karthik@shareskill.cloud",
    city: "Bengaluru",
    country: "India",
    bio: "Software tutor passionate about programming fundamentals, algorithms, and clean code.",
    avatarUrl: "",
    teachSkills: [
      { id: "s-t-3", name: "Python basics", category: "Programming", level: "Beginner" },
      { id: "s-t-4", name: "HTML & CSS", category: "Programming", level: "Beginner" }
    ],
    learnSkills: [
      { id: "s-l-3", name: "Cloud Architecture", category: "Programming", level: "Intermediate" }
    ],
    availability: "Weekday evenings",
    locationPreference: "Online"
  },
  {
    id: "user-arun",
    name: "Arun Kumar",
    email: "arun@shareskill.cloud",
    city: "Coimbatore",
    country: "India",
    bio: "Financial analyst and Excel wizard. Passionate about exchanging Excel data models, advanced formulas, and dashboards for Python programming fundamentals.",
    avatarUrl: "",
    teachSkills: [
      { id: "s-t-arun-1", name: "Excel", category: "Data Analysis", level: "Expert" },
      { id: "s-t-arun-2", name: "Power BI", category: "Data Analysis", level: "Intermediate" }
    ],
    learnSkills: [
      { id: "s-l-arun-1", name: "Python", category: "Programming", level: "Beginner" }
    ],
    availability: "Weekday evenings",
    locationPreference: "Online"
  }
];

let users: UserProfile[] = SEED_DEMO ? SEED_USERS : [];

// Requests matching the reference video and accepted exchanges:
const SEED_REQUESTS: ExchangeRequest[] = [
  {
    id: "req-arun",
    senderId: "user-arun",
    receiverId: "user-jeeva",
    senderName: "Arun Kumar",
    receiverName: "Jeeva bharathi D",
    senderCity: "Coimbatore , India",
    receiverCity: "Thanjavur , India",
    skillOffered: "Excel",
    skillRequested: "Python",
    message: "Hi Jeeva! I can teach you advanced Excel modeling & dashboards in exchange for Python fundamentals.",
    status: "accepted",
    createdAt: "9/15/2026",
    type: "incoming"
  },
  {
    id: "req-3",
    senderId: "user-darksoul",
    receiverId: "user-jeeva",
    senderName: "Darksoul",
    receiverName: "Jeeva bharathi D",
    senderCity: "Chennai , India",
    receiverCity: "Thanjavur , India",
    skillOffered: "Web development",
    skillRequested: "Python",
    message: "Bro send me your location i will come taught web dev",
    status: "accepted",
    createdAt: "7/28/2026",
    type: "incoming"
  },
  {
    id: "req-4",
    senderId: "user-jeeva",
    receiverId: "user-darksoul",
    senderName: "Jeeva bharathi D",
    receiverName: "Darksoul",
    senderCity: "Thanjavur , India",
    receiverCity: "Chennai , India",
    skillOffered: "Python basic",
    skillRequested: "Web development",
    message: "hi can you teach me web dev eventually i will tech u python",
    status: "accepted",
    createdAt: "7/28/2026",
    type: "sent"
  }
];
let requests: ExchangeRequest[] = SEED_DEMO ? SEED_REQUESTS : [];

// Data persistence and uploads storage
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Users Storage & Persistence
const USERS_FILE = path.join(DATA_DIR, "users.json");
try {
  if (fs.existsSync(USERS_FILE)) {
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const parsedUsers = JSON.parse(raw);
    if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
      users = parsedUsers;
    }
  } else {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  }
} catch (e) {
  console.warn("Could not read users file:", e);
}

function saveUsersToDisk() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save users to disk:", e);
  }
}

const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
let messages: ChatMessage[] = [];

try {
  if (fs.existsSync(MESSAGES_FILE)) {
    const raw = fs.readFileSync(MESSAGES_FILE, "utf-8");
    messages = JSON.parse(raw);
  }
} catch (e) {
  console.warn("Could not read messages file:", e);
}

function saveMessagesToDisk() {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save messages to disk:", e);
  }
}

// Sessions Storage & Persistence
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
let sessions: SkillExchangeSession[] = [];

try {
  if (fs.existsSync(SESSIONS_FILE)) {
    const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
    sessions = JSON.parse(raw);
  }
} catch (e) {
  console.warn("Could not read sessions file:", e);
}

if (SEED_DEMO && sessions.length === 0) {
  sessions = [
    {
      id: "session-arun-1",
      exchangeId: "req-arun",
      partnerId: "user-arun",
      partnerName: "Arun Kumar",
      partnerEmail: "arun@shareskill.cloud",
      partnerCity: "Coimbatore",
      partnerCountry: "India",
      partnerBio: "Financial analyst and Excel wizard. Passionate about exchanging Excel data models, advanced formulas, and dashboards for Python programming fundamentals.",
      partnerAvailability: "Weekday evenings",
      myTeachSkill: "Python",
      partnerTeachSkill: "Excel",
      date: "2026-09-18",
      time: "7:00 PM",
      learningMode: "Online",
      status: "Scheduled",
      notes: "Topics to cover:\n1. Excel formula structures (XLOOKUP, INDEX/MATCH, and dynamic arrays)\n2. Python data structures (lists, dictionaries, sets)\n3. Practice exercise: Clean CSV data and automate summary reporting",
      notesUpdatedAt: new Date().toISOString(),
      feedback: null,
      createdAt: "2026-09-15T18:00:00.000Z",
      updatedAt: "2026-09-15T18:00:00.000Z"
    },
    {
      id: "session-darksoul-1",
      exchangeId: "req-3",
      partnerId: "user-darksoul",
      partnerName: "Darksoul",
      partnerEmail: "darksoul@shareskill.cloud",
      partnerCity: "Chennai",
      partnerCountry: "India",
      partnerBio: "Full-stack web engineer enthusiastic about algorithms and python.",
      partnerAvailability: "Flexible / anytime",
      myTeachSkill: "Python basic",
      partnerTeachSkill: "Web development",
      date: "2026-09-12",
      time: "6:00 PM",
      learningMode: "Online",
      status: "Completed",
      notes: "Covered modern CSS flexbox & grid fundamentals. Built basic REST API endpoints in Express. Reviewed Python loop logic.",
      notesUpdatedAt: "2026-09-12T19:30:00.000Z",
      feedback: {
        id: "fb-1",
        rating: 5,
        feedbackText: "Brilliant hands-on session! Covered web dev principles thoroughly and gave practical coding exercises.",
        submittedBy: "user-jeeva",
        submittedByName: "Jeeva bharathi D",
        createdAt: "2026-09-12T19:45:00.000Z"
      },
      createdAt: "2026-09-10T14:00:00.000Z",
      updatedAt: "2026-09-12T19:45:00.000Z"
    }
  ];
  saveSessionsToDisk();
}

function saveSessionsToDisk() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save sessions to disk:", e);
  }
}

// Recent Activities Persistence
const ACTIVITIES_FILE = path.join(DATA_DIR, "activities.json");
let activities: ActivityItem[] = [];

try {
  if (fs.existsSync(ACTIVITIES_FILE)) {
    const raw = fs.readFileSync(ACTIVITIES_FILE, "utf-8");
    activities = JSON.parse(raw);
  }
} catch (e) {
  console.warn("Could not read activities file:", e);
}

if (SEED_DEMO && activities.length === 0) {
  activities = [
    {
      id: "act-1",
      type: "session_scheduled",
      title: "Session scheduled",
      description: "Next session with Arun Kumar (Python ↔ Excel) set for Sep 18 at 7:00 PM.",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      timeAgo: "1 hour ago",
      relatedId: "session-arun-1",
      partnerName: "Arun Kumar"
    },
    {
      id: "act-2",
      type: "request_accepted",
      title: "Exchange request accepted",
      description: "Exchange with Arun Kumar is active: teaching Python, learning Excel.",
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      timeAgo: "4 hours ago",
      relatedId: "req-arun",
      partnerName: "Arun Kumar"
    },
    {
      id: "act-3",
      type: "new_message",
      title: "New message",
      description: "New message from Darksoul: 'Bro send me your location i will come taught web dev'",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      timeAgo: "Yesterday",
      relatedId: "user-darksoul",
      partnerName: "Darksoul"
    },
    {
      id: "act-4",
      type: "new_match",
      title: "New match",
      description: "Compatible match with Karthik R: teaches HTML & CSS, learning Cloud Architecture.",
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      timeAgo: "2 days ago",
      relatedId: "user-karthik",
      partnerName: "Karthik R"
    },
    {
      id: "act-5",
      type: "session_completed",
      title: "Session completed",
      description: "Completed session with Darksoul on Web development. 5-star rating submitted.",
      timestamp: new Date(Date.now() - 259200000).toISOString(),
      timeAgo: "3 days ago",
      relatedId: "session-darksoul-1",
      partnerName: "Darksoul"
    }
  ];
  saveActivitiesToDisk();
}

function saveActivitiesToDisk() {
  try {
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activities, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save activities to disk:", e);
  }
}

function addActivity(
  type: ActivityItem["type"],
  title: string,
  description: string,
  relatedId?: string,
  partnerName?: string
) {
  const newItem: ActivityItem = {
    id: "act-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    type,
    title,
    description,
    timestamp: new Date().toISOString(),
    timeAgo: "Just now",
    relatedId,
    partnerName
  };
  activities.unshift(newItem);
  if (activities.length > 50) activities = activities.slice(0, 50);
  saveActivitiesToDisk();
  return newItem;
}

// Helper: Check if exchange is accepted or completed
function isExchangeAccepted(userAId: string, userBId: string): boolean {
  return requests.some(r =>
    (r.status === "accepted" || r.status === "completed") &&
    ((r.senderId === userAId && r.receiverId === userBId) ||
     (r.senderId === userBId && r.receiverId === userAId))
  );
}

// SSE Real-time clients
const sseClients: Map<string, Set<express.Response>> = new Map();

function broadcastMessage(msg: ChatMessage) {
  const notifyUser = (userId: string) => {
    const conns = sseClients.get(userId);
    if (conns) {
      const payload = `data: ${JSON.stringify({ type: 'new_message', message: msg })}\n\n`;
      for (const client of conns) {
        try {
          client.write(payload);
        } catch {
          conns.delete(client);
        }
      }
    }
  };
  notifyUser(msg.senderId);
  notifyUser(msg.receiverId);
}

function broadcastStatusUpdate(partnerId: string, messageIds: string[], status: 'delivered' | 'read') {
  const conns = sseClients.get(partnerId);
  if (conns) {
    const payload = `data: ${JSON.stringify({ type: 'status_update', messageIds, status })}\n\n`;
    for (const client of conns) {
      try {
        client.write(payload);
      } catch {
        conns.delete(client);
      }
    }
  }
}

function broadcastMessageDelete(messageId: string, senderId: string, receiverId: string) {
  const notifyUser = (userId: string) => {
    const conns = sseClients.get(userId);
    if (conns) {
      const payload = `data: ${JSON.stringify({ type: 'delete_message', messageId })}\n\n`;
      for (const client of conns) {
        try {
          client.write(payload);
        } catch {
          conns.delete(client);
        }
      }
    }
  };
  notifyUser(senderId);
  notifyUser(receiverId);
}

function broadcastMessageUpdate(updatedMsg: ChatMessage) {
  const notifyUser = (userId: string) => {
    const conns = sseClients.get(userId);
    if (conns) {
      const payload = `data: ${JSON.stringify({ type: 'update_message', message: updatedMsg })}\n\n`;
      for (const client of conns) {
        try {
          client.write(payload);
        } catch {
          conns.delete(client);
        }
      }
    }
  };
  notifyUser(updatedMsg.senderId);
  notifyUser(updatedMsg.receiverId);
}

function deleteUploadedMediaFile(mediaUrl?: string) {
  if (!mediaUrl) return;
  if (mediaUrl.startsWith("/uploads/")) {
    const filename = path.basename(mediaUrl);
    const fullPath = path.join(UPLOADS_DIR, filename);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`[Storage] Deleted media file from disk: ${filename}`);
      }
    } catch (e) {
      console.warn(`[Storage] Failed to delete media file ${filename}:`, e);
    }
  }
}

const progressByUser: Record<string, UserProgress> = {};
function getProgress(userId: string): UserProgress {
  if (!progressByUser[userId]) {
    progressByUser[userId] = { currentStreak: 0, longestStreak: 0, minutesThisWeek: 0, weeklyTarget: 120, goals: [], logs: [] };
  }
  return progressByUser[userId];
}

// WebRTC Signaling room buffer
const webrtcRooms: Record<string, WebRTCSignal[]> = {};


// ---------------------------------------------------------------------------
// Supabase: auth verification + durable storage of app state
// ---------------------------------------------------------------------------
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function loadStateFromCloud() {
  if (!supabaseAdmin) {
    console.warn("[Supabase] SUPABASE_SERVICE_ROLE_KEY not set: data is kept only on local disk/memory.");
    return;
  }
  const { data, error } = await supabaseAdmin.from("app_state").select("key,value");
  if (error) {
    console.error("[Supabase] Could not load app_state:", error.message);
    return;
  }
  for (const row of data || []) {
    const v = row.value;
    if (row.key === "users" && Array.isArray(v)) users = v;
    else if (row.key === "requests" && Array.isArray(v)) requests = v;
    else if (row.key === "messages" && Array.isArray(v)) messages = v;
    else if (row.key === "sessions" && Array.isArray(v)) sessions = v;
    else if (row.key === "activities" && Array.isArray(v)) activities = v;
    else if (row.key === "progress" && v && typeof v === "object") Object.assign(progressByUser, v);
  }
  console.log("[Supabase] State loaded from app_state.");
}

let cloudSaveTimer: NodeJS.Timeout | null = null;
function scheduleCloudSave() {
  if (!supabaseAdmin) return;
  if (cloudSaveTimer) return;
  cloudSaveTimer = setTimeout(async () => {
    cloudSaveTimer = null;
    const now = new Date().toISOString();
    const rows = [
      { key: "users", value: users },
      { key: "requests", value: requests },
      { key: "messages", value: messages },
      { key: "sessions", value: sessions },
      { key: "activities", value: activities },
      { key: "progress", value: progressByUser }
    ].map(r => ({ ...r, updated_at: now }));
    const { error } = await supabaseAdmin!.from("app_state").upsert(rows, { onConflict: "key" });
    if (error) console.error("[Supabase] Save failed:", error.message);
  }, 800);
}

function profileFromSupabaseUser(su: any): UserProfile {
  const meta = su.user_metadata || {};
  const email: string = su.email || "";
  return {
    id: su.id,
    name: meta.full_name || meta.name || (email ? email.split("@")[0].replace(/[._-]/g, " ") : "Member"),
    email,
    city: meta.city || "Online",
    country: meta.country || "Global",
    bio: meta.bio || "",
    avatarUrl: meta.avatar_url || meta.picture || "",
    teachSkills: [],
    learnSkills: [],
    availability: "Flexible / anytime",
    locationPreference: "Online"
  };
}

function getOrCreateUser(su: any): UserProfile {
  let existing = users.find(u => u.id === su.id);
  if (!existing) {
    existing = profileFromSupabaseUser(su);
    users.push(existing);
    saveUsersToDisk();
    scheduleCloudSave();
  }
  return existing;
}

const tokenCache = new Map<string, { user: any; exp: number }>();

export async function createApp() {
  await loadStateFromCloud();
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Verify the Supabase access token on every API call and attach the caller.
  app.use("/api", async (req, res, next) => {
    if (req.path === "/health") return next();
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : ((req.query.token as string) || "");
    if (!token) return res.status(401).json({ error: "Not signed in" });
    try {
      let cached = tokenCache.get(token);
      if (!cached || cached.exp < Date.now()) {
        const { data, error } = await supabaseAuth.auth.getUser(token);
        if (error || !data.user) return res.status(401).json({ error: "Invalid or expired session" });
        cached = { user: data.user, exp: Date.now() + 60_000 };
        tokenCache.set(token, cached);
        if (tokenCache.size > 500) tokenCache.clear();
      }
      req.user = getOrCreateUser(cached.user);
      next();
    } catch (e: any) {
      console.error("[Auth] verify failed:", e?.message || e);
      res.status(401).json({ error: "Authentication failed" });
    }
  });

  // Persist state to Supabase after any write request.
  app.use("/api", (req, res, next) => {
    if (req.method !== "GET") res.on("finish", () => scheduleCloudSave());
    next();
  });

  // API Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth & Profile
  app.get("/api/auth/me", (req, res) => {
    res.json(req.user);
  });

  app.get("/api/profile", (req, res) => {
    res.json(req.user);
  });

  app.put("/api/profile", (req, res) => {
    const { name, city, country, bio, availability, locationPreference, avatarUrl } = req.body;
    req.user.name = name ?? req.user.name;
    req.user.city = city ?? req.user.city;
    req.user.country = country ?? req.user.country;
    req.user.bio = bio ?? req.user.bio;
    if (availability) req.user.availability = availability;
    if (locationPreference) req.user.locationPreference = locationPreference;
    if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl;

    // Update in user list
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx !== -1) {
      users[idx] = { ...req.user };
    }
    saveUsersToDisk();
    res.json(req.user);
  });

  // Dedicated Avatar Upload & Crop Save endpoint
  app.post("/api/profile/avatar", (req, res) => {
    try {
      const { fileData, fileName, mimeType } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "No image file provided" });
      }

      let base64Content = fileData;
      let ext = "jpg";

      if (fileData.includes(";base64,")) {
        const parts = fileData.split(";base64,");
        const header = parts[0].toLowerCase();
        if (!header.includes("image/")) {
          return res.status(400).json({ error: "File must be an image (JPEG, PNG, WebP, GIF)" });
        }
        if (header.includes("png")) ext = "png";
        else if (header.includes("webp")) ext = "webp";
        else if (header.includes("gif")) ext = "gif";
        base64Content = parts[1];
      } else if (fileData.includes(",")) {
        base64Content = fileData.split(",")[1];
      }

      if (fileName) {
        const parsedExt = path.extname(fileName).slice(1).toLowerCase();
        if (["jpg", "jpeg", "png", "webp", "gif"].includes(parsedExt)) {
          ext = parsedExt === "jpeg" ? "jpg" : parsedExt;
        }
      }

      const buffer = Buffer.from(base64Content, "base64");
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "Image file exceeds maximum limit of 10MB" });
      }

      // Remove existing custom avatar file if present
      if (req.user.avatarUrl && req.user.avatarUrl.startsWith("/uploads/avatar_")) {
        try {
          const oldFile = path.join(UPLOADS_DIR, path.basename(req.user.avatarUrl));
          if (fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile);
          }
        } catch (cleanErr) {
          console.warn("Could not remove previous avatar file:", cleanErr);
        }
      }

      const newFileName = `avatar_${req.user.id}_${Date.now()}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, newFileName);
      fs.writeFileSync(filePath, buffer);

      req.user.avatarUrl = `/uploads/${newFileName}`;

      const idx = users.findIndex(u => u.id === req.user.id);
      if (idx !== -1) {
        users[idx] = { ...req.user };
      }
      saveUsersToDisk();

      res.json({
        success: true,
        avatarUrl: req.user.avatarUrl,
        user: req.user
      });
    } catch (err: any) {
      console.error("Avatar save error:", err);
      res.status(500).json({ error: "Failed to save profile picture: " + (err?.message || "Unknown error") });
    }
  });

  // Remove Profile Picture endpoint
  app.delete("/api/profile/avatar", (req, res) => {
    try {
      if (req.user.avatarUrl && req.user.avatarUrl.startsWith("/uploads/avatar_")) {
        try {
          const oldFile = path.join(UPLOADS_DIR, path.basename(req.user.avatarUrl));
          if (fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile);
          }
        } catch (cleanErr) {
          console.warn("Could not remove avatar file:", cleanErr);
        }
      }

      req.user.avatarUrl = "";

      const idx = users.findIndex(u => u.id === req.user.id);
      if (idx !== -1) {
        users[idx] = { ...req.user };
      }
      saveUsersToDisk();

      res.json({
        success: true,
        user: req.user
      });
    } catch (err: any) {
      console.error("Avatar remove error:", err);
      res.status(500).json({ error: "Failed to remove profile picture" });
    }
  });

  app.post("/api/profile/skills", (req, res) => {
    const { type, name, category, level } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Skill name is required" });
    }
    const newSkill: SkillItem = {
      id: "s-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      category: category || "Programming",
      level: level || "Intermediate"
    };
    if (type === "teach") {
      req.user.teachSkills.push(newSkill);
    } else {
      req.user.learnSkills.push(newSkill);
    }
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx !== -1) users[idx] = { ...req.user };
    saveUsersToDisk();
    res.json(req.user);
  });

  app.delete("/api/profile/skills/:id", (req, res) => {
    const { id } = req.params;
    req.user.teachSkills = req.user.teachSkills.filter(s => s.id !== id);
    req.user.learnSkills = req.user.learnSkills.filter(s => s.id !== id);
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx !== -1) users[idx] = { ...req.user };
    saveUsersToDisk();
    res.json(req.user);
  });

  // Members
  app.get("/api/members", (req, res) => {
    const q = (req.query.q as string || "").toLowerCase();
    const category = (req.query.category as string || "All categories").toLowerCase();

    const filtered = users.filter(user => {
      if (user.id === req.user.id) return false;
      const matchQuery = !q ||
        user.name.toLowerCase().includes(q) ||
        user.city.toLowerCase().includes(q) ||
        user.teachSkills.some(s => s.name.toLowerCase().includes(q)) ||
        user.learnSkills.some(s => s.name.toLowerCase().includes(q));

      const matchCategory = category === "all categories" ||
        user.teachSkills.some(s => s.category.toLowerCase() === category) ||
        user.learnSkills.some(s => s.category.toLowerCase() === category);

      return matchQuery && matchCategory;
    });

    res.json(filtered);
  });

  // Delete Member endpoint
  app.delete("/api/members/:id", (req, res) => {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own active account" });
    }
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: "Member not found" });
    }
    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);

    // Clean up any requests involving this user
    requests = requests.filter(r => r.senderId !== id && r.receiverId !== id);
    // Clean up any messages involving this user
    messages = messages.filter(m => m.senderId !== id && m.receiverId !== id);
    saveMessagesToDisk();

    res.json({ success: true, message: `Member ${deletedUser.name} removed successfully` });
  });

  // Match finder
  app.get("/api/matches", (req, res) => {
    const learn = (req.query.learn as string || "").toLowerCase();
    const teach = (req.query.teach as string || "").toLowerCase();
    const level = (req.query.level as string || "").toLowerCase();
    const availability = (req.query.availability as string || "").toLowerCase();
    const mode = (req.query.mode as string || "").toLowerCase();

    // Rank real members based on skill overlap
    const ranked = users
      .filter(u => u.id !== req.user.id)
      .map(member => {
        let score = 0;
        const teachesWanted = member.teachSkills.some(s =>
          learn && (s.name.toLowerCase().includes(learn) || learn.includes(s.name.toLowerCase()))
        );
        if (teachesWanted) score += 50;

        const wantsTaught = member.learnSkills.some(s =>
          teach && (s.name.toLowerCase().includes(teach) || teach.includes(s.name.toLowerCase()))
        );
        if (wantsTaught) score += 50;

        if (availability && member.availability?.toLowerCase() === availability) {
          score += 15;
        }
        if (mode && member.locationPreference?.toLowerCase() === mode) {
          score += 10;
        }

        return {
          member,
          compatibilityScore: score,
          reciprocalMatch: teachesWanted && wantsTaught
        };
      })
      .filter(item => item.compatibilityScore > 0)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    res.json(ranked);
  });

  // Requests
  app.get("/api/requests", (req, res) => {
    const enrichRequest = (r: ExchangeRequest) => {
      const sender = users.find(u => u.id === r.senderId);
      const receiver = users.find(u => u.id === r.receiverId);
      return {
        ...r,
        senderAvatar: sender?.avatarUrl || (r as any).senderAvatar || "",
        receiverAvatar: receiver?.avatarUrl || (r as any).receiverAvatar || ""
      };
    };

    const incoming = requests
      .filter(r => r.receiverId === req.user.id || r.type === "incoming")
      .map(enrichRequest);
    const sent = requests
      .filter(r => r.senderId === req.user.id || r.type === "sent")
      .map(enrichRequest);
    res.json({ incoming, sent });
  });

  app.post("/api/requests", (req, res) => {
    const { receiverId, skillOffered, skillRequested, message } = req.body;
    const targetUser = users.find(u => u.id === receiverId);
    if (!targetUser) {
      return res.status(404).json({ error: "Member not found" });
    }
    const newReq: ExchangeRequest = {
      id: "req-" + Date.now(),
      senderId: req.user.id,
      receiverId: targetUser.id,
      senderName: req.user.name,
      receiverName: targetUser.name,
      senderCity: `${req.user.city} , ${req.user.country}`,
      receiverCity: `${targetUser.city} , ${targetUser.country}`,
      senderAvatar: req.user.avatarUrl || "",
      receiverAvatar: targetUser.avatarUrl || "",
      skillOffered: skillOffered || req.user.teachSkills[0]?.name || "Skill",
      skillRequested: skillRequested || targetUser.teachSkills[0]?.name || "Skill",
      message: message || "",
      status: "pending",
      createdAt: new Date().toLocaleDateString(),
      type: "sent"
    };
    requests.unshift(newReq);
    res.json(newReq);
  });

  app.patch("/api/requests/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const reqItem = requests.find(r => r.id === id);
    if (!reqItem) {
      return res.status(404).json({ error: "Request not found" });
    }
    const oldStatus = reqItem.status;
    reqItem.status = status;

    if (status === "accepted" && oldStatus !== "accepted") {
      const partnerId = reqItem.senderId === req.user.id ? reqItem.receiverId : reqItem.senderId;
      const partner = users.find(u => u.id === partnerId);
      
      let existingSession = sessions.find(s => s.exchangeId === reqItem.id);
      if (!existingSession && partner) {
        existingSession = {
          id: "session-" + reqItem.id,
          exchangeId: reqItem.id,
          partnerId: partner.id,
          partnerName: partner.name,
          partnerEmail: partner.email,
          partnerCity: partner.city,
          partnerCountry: partner.country,
          partnerBio: partner.bio,
          partnerAvailability: partner.availability,
          myTeachSkill: reqItem.senderId === req.user.id ? reqItem.skillOffered : reqItem.skillRequested,
          partnerTeachSkill: reqItem.senderId === req.user.id ? reqItem.skillRequested : reqItem.skillOffered,
          date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          time: "7:00 PM",
          learningMode: "Online",
          status: "Scheduled",
          notes: "",
          feedback: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        sessions.unshift(existingSession);
        saveSessionsToDisk();
      }

      addActivity(
        "request_accepted",
        "Exchange request accepted",
        `Exchange request accepted: ${reqItem.skillOffered} ↔ ${reqItem.skillRequested} with ${partner?.name || "Partner"}.`,
        reqItem.id,
        partner?.name
      );
    }

    res.json(reqItem);
  });

  // Recommended Skill Partners (using actual matching system)
  app.get("/api/recommendations", (req, res) => {
    const myTeaches = req.user.teachSkills.map(s => s.name.toLowerCase());
    const myLearns = req.user.learnSkills.map(s => s.name.toLowerCase());

    const recommended: RecommendedPartner[] = users
      .filter(u => u.id !== req.user.id)
      .map(member => {
        let score = 0;
        const matchReasons: string[] = [];

        // Check if member teaches what current user wants to learn
        const teachesMatch = member.teachSkills.find(ts => 
          myLearns.some(ml => ts.name.toLowerCase().includes(ml) || ml.includes(ts.name.toLowerCase()))
        );
        if (teachesMatch) {
          score += 45;
          matchReasons.push(`Teaches ${teachesMatch.name}`);
        }

        // Check if member wants to learn what current user teaches
        const learnsMatch = member.learnSkills.find(ls => 
          myTeaches.some(mt => ls.name.toLowerCase().includes(mt) || mt.includes(ls.name.toLowerCase()))
        );
        if (learnsMatch) {
          score += 45;
          matchReasons.push(`Wants to learn ${learnsMatch.name}`);
        }

        const isReciprocal = Boolean(teachesMatch && learnsMatch);
        if (isReciprocal) {
          score += 10;
          matchReasons.unshift("100% Reciprocal Skill Match");
        }

        if (member.locationPreference === req.user.locationPreference) {
          score += 5;
          matchReasons.push(`Both prefer ${member.locationPreference}`);
        }

        if (score === 0) {
          score = 65;
          matchReasons.push("Active community member");
        }

        return {
          member,
          compatibilityScore: Math.min(score, 99),
          reciprocalMatch: isReciprocal,
          matchReasons
        };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    res.json(recommended);
  });

  // Dynamic Recent Activities (stored in existing DB)
  app.get("/api/activities", (req, res) => {
    const now = Date.now();
    const formatted = activities.map(act => {
      const diff = Math.max(0, now - new Date(act.timestamp).getTime());
      let timeAgo = "Just now";
      if (diff < 60000) {
        timeAgo = "Just now";
      } else if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        timeAgo = `${mins}m ago`;
      } else if (diff < 86400000) {
        const hrs = Math.floor(diff / 3600000);
        timeAgo = `${hrs}h ago`;
      } else if (diff < 172800000) {
        timeAgo = "Yesterday";
      } else {
        const days = Math.floor(diff / 86400000);
        timeAgo = `${days}d ago`;
      }
      return { ...act, timeAgo };
    });
    res.json(formatted);
  });

  // Sessions: Get all sessions for active exchanges
  app.get("/api/sessions", (req, res) => {
    const acceptedRequests = requests.filter(r =>
      (r.status === "accepted" || r.status === "completed") &&
      (r.senderId === req.user.id || r.receiverId === req.user.id)
    );

    let changed = false;
    for (const r of acceptedRequests) {
      let existing = sessions.find(s => s.exchangeId === r.id);
      if (!existing) {
        const partnerId = r.senderId === req.user.id ? r.receiverId : r.senderId;
        const partner = users.find(u => u.id === partnerId);
        if (partner) {
          const newSession: SkillExchangeSession = {
            id: "session-" + r.id,
            exchangeId: r.id,
            partnerId: partner.id,
            partnerName: partner.name,
            partnerEmail: partner.email,
            partnerCity: partner.city,
            partnerCountry: partner.country,
            partnerBio: partner.bio,
            partnerAvailability: partner.availability,
            myTeachSkill: r.senderId === req.user.id ? r.skillOffered : r.skillRequested,
            partnerTeachSkill: r.senderId === req.user.id ? r.skillRequested : r.skillOffered,
            date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            time: "7:00 PM",
            learningMode: "Online",
            status: "Scheduled",
            notes: "",
            feedback: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          sessions.unshift(newSession);
          changed = true;
        }
      }
    }
    if (changed) saveSessionsToDisk();

    const enrichSession = (s: SkillExchangeSession) => {
      const partner = users.find(u => u.id === s.partnerId);
      return {
        ...s,
        partnerAvatar: partner?.avatarUrl || s.partnerAvatar || ""
      };
    };

    res.json(sessions.map(enrichSession));
  });

  // Get single session by sessionId or exchangeId
  app.get("/api/sessions/:id", (req, res) => {
    const { id } = req.params;
    let found = sessions.find(s => s.id === id || s.exchangeId === id);
    if (!found) {
      const r = requests.find(reqItem => reqItem.id === id);
      if (r && (r.status === "accepted" || r.status === "completed")) {
        const partnerId = r.senderId === req.user.id ? r.receiverId : r.senderId;
        const partner = users.find(u => u.id === partnerId);
        if (partner) {
          found = {
            id: "session-" + r.id,
            exchangeId: r.id,
            partnerId: partner.id,
            partnerName: partner.name,
            partnerEmail: partner.email,
            partnerAvatar: partner.avatarUrl || "",
            partnerCity: partner.city,
            partnerCountry: partner.country,
            partnerBio: partner.bio,
            partnerAvailability: partner.availability,
            myTeachSkill: r.senderId === req.user.id ? r.skillOffered : r.skillRequested,
            partnerTeachSkill: r.senderId === req.user.id ? r.skillRequested : r.skillOffered,
            date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            time: "7:00 PM",
            learningMode: "Online",
            status: "Scheduled",
            notes: "",
            feedback: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          sessions.unshift(found);
          saveSessionsToDisk();
        }
      }
    }

    if (!found) {
      return res.status(404).json({ error: "Session not found" });
    }

    const partner = users.find(u => u.id === found.partnerId);
    res.json({
      ...found,
      partnerAvatar: partner?.avatarUrl || found.partnerAvatar || ""
    });
  });

  // Create or Schedule a Session
  app.post("/api/sessions", (req, res) => {
    const { exchangeId, partnerId, date, time, learningMode, notes } = req.body;
    const partner = users.find(u => u.id === partnerId);
    if (!partner) {
      return res.status(404).json({ error: "Partner not found" });
    }
    const exchange = requests.find(r => r.id === exchangeId);

    const newSession: SkillExchangeSession = {
      id: "session-" + Date.now(),
      exchangeId: exchangeId || "ex-" + Date.now(),
      partnerId: partner.id,
      partnerName: partner.name,
      partnerEmail: partner.email,
      partnerCity: partner.city,
      partnerCountry: partner.country,
      partnerBio: partner.bio,
      partnerAvailability: partner.availability,
      myTeachSkill: exchange ? (exchange.senderId === req.user.id ? exchange.skillOffered : exchange.skillRequested) : (req.user.teachSkills[0]?.name || "Skill"),
      partnerTeachSkill: exchange ? (exchange.senderId === req.user.id ? exchange.skillRequested : exchange.skillOffered) : (partner.teachSkills[0]?.name || "Skill"),
      date: date || new Date(Date.now() + 86400000).toISOString().split("T")[0],
      time: time || "7:00 PM",
      learningMode: learningMode || "Online",
      status: "Scheduled",
      notes: notes || "",
      feedback: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    sessions.unshift(newSession);
    saveSessionsToDisk();

    addActivity(
      "session_scheduled",
      "Session scheduled",
      `Session scheduled with ${partner.name} (${newSession.myTeachSkill} ↔ ${newSession.partnerTeachSkill}) on ${newSession.date} at ${newSession.time}.`,
      newSession.id,
      partner.name
    );

    res.json(newSession);
  });

  // Update session (date, time, mode, status, notes)
  app.patch("/api/sessions/:id", (req, res) => {
    const { id } = req.params;
    const session = sessions.find(s => s.id === id || s.exchangeId === id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { date, time, learningMode, status, notes } = req.body;
    const oldStatus = session.status;

    if (date !== undefined) session.date = date;
    if (time !== undefined) session.time = time;
    if (learningMode !== undefined) session.learningMode = learningMode;
    if (status !== undefined) session.status = status as SessionStatus;
    if (notes !== undefined) {
      session.notes = notes;
      session.notesUpdatedAt = new Date().toISOString();
    }
    session.updatedAt = new Date().toISOString();

    saveSessionsToDisk();

    // Activities for status change or rescheduling
    if (status && status !== oldStatus) {
      if (status === "Completed") {
        addActivity(
          "session_completed",
          "Session completed",
          `Session with ${session.partnerName} (${session.myTeachSkill} ↔ ${session.partnerTeachSkill}) marked completed.`,
          session.id,
          session.partnerName
        );
      } else if (status === "In Progress") {
        addActivity(
          "session_scheduled",
          "Session in progress",
          `Live session with ${session.partnerName} is now in progress.`,
          session.id,
          session.partnerName
        );
      }
    } else if (date || time) {
      addActivity(
        "session_scheduled",
        "Session scheduled",
        `Session with ${session.partnerName} scheduled for ${session.date} at ${session.time}.`,
        session.id,
        session.partnerName
      );
    }

    res.json(session);
  });

  // Save session notes specifically
  app.post("/api/sessions/:id/notes", (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    const session = sessions.find(s => s.id === id || s.exchangeId === id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    session.notes = notes ?? "";
    session.notesUpdatedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();
    saveSessionsToDisk();

    res.json({ success: true, notes: session.notes, notesUpdatedAt: session.notesUpdatedAt });
  });

  // Submit session feedback and rating
  app.post("/api/sessions/:id/feedback", (req, res) => {
    const { id } = req.params;
    const { rating, feedbackText } = req.body;
    const session = sessions.find(s => s.id === id || s.exchangeId === id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: "Valid rating between 1 and 5 stars is required" });
    }

    const fb: SessionFeedback = {
      id: "fb-" + Date.now(),
      rating: numRating,
      feedbackText: (feedbackText || "").trim(),
      submittedBy: req.user.id,
      submittedByName: req.user.name,
      createdAt: new Date().toISOString()
    };

    session.feedback = fb;
    session.status = "Completed";
    session.updatedAt = new Date().toISOString();
    saveSessionsToDisk();

    addActivity(
      "session_completed",
      "Session completed & rated",
      `Submitted ${numRating}-star rating for session with ${session.partnerName}.`,
      session.id,
      session.partnerName
    );

    res.json({ success: true, session });
  });

  // Real-Time Messages, Media, & Conversations
  // SSE Event Stream for live instant messages
  app.get("/api/messages/stream", (req, res) => {
    const userId = req.user.id;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: "connected", userId })}\n\n`);

    if (!sseClients.has(userId)) {
      sseClients.set(userId, new Set());
    }
    const userConns = sseClients.get(userId)!;
    userConns.add(res);

    const interval = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(interval);
      }
    }, 20000);

    req.on("close", () => {
      clearInterval(interval);
      userConns.delete(res);
      if (userConns.size === 0) {
        sseClients.delete(userId);
      }
    });
  });

  // Real File Upload endpoint
  app.post("/api/upload", (req, res) => {
    try {
      const { fileData, fileName, fileType } = req.body;
      if (!fileData || !fileName) {
        return res.status(400).json({ error: "Missing file data or file name" });
      }

      let base64Content = fileData;
      if (fileData.includes(",")) {
        base64Content = fileData.split(",")[1];
      }
      const buffer = Buffer.from(base64Content, "base64");

      const ext = path.extname(fileName) || "";
      const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
      const uniqueFileName = `${Date.now()}_${baseName}${ext}`;
      const filePath = path.join(UPLOADS_DIR, uniqueFileName);

      fs.writeFileSync(filePath, buffer);

      let mediaType: MessageMediaType = "document";
      const mime = (fileType || "").toLowerCase();
      const extension = ext.toLowerCase();

      if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(extension)) {
        mediaType = "image";
      } else if (mime.startsWith("video/") || [".mp4", ".webm", ".mov", ".mkv"].includes(extension)) {
        mediaType = "video";
      } else if (mime.startsWith("audio/") || [".mp3", ".wav", ".ogg", ".m4a", ".aac"].includes(extension)) {
        mediaType = "audio";
      } else if (mime === "application/pdf" || extension === ".pdf") {
        mediaType = "pdf";
      } else {
        mediaType = "document";
      }

      res.json({
        url: `/uploads/${uniqueFileName}`,
        fileName,
        fileSize: buffer.length,
        mediaType
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Failed to upload file: " + (err?.message || "Unknown error") });
    }
  });

  // Conversations List: only users with an accepted/completed Skill Exchange
  app.get("/api/conversations", (req, res) => {
    const acceptedRequests = requests.filter(r =>
      (r.status === "accepted" || r.status === "completed") &&
      (r.senderId === req.user.id || r.receiverId === req.user.id)
    );

    const convMap = new Map<string, any>();

    for (const r of acceptedRequests) {
      const partnerId = r.senderId === req.user.id ? r.receiverId : r.senderId;
      const partnerName = r.senderId === req.user.id ? r.receiverName : r.senderName;
      const partnerProfile = users.find(u => u.id === partnerId);

      if (!convMap.has(partnerId)) {
        const conversationMsgs = messages.filter(
          m => (m.senderId === req.user.id && m.receiverId === partnerId) ||
               (m.senderId === partnerId && m.receiverId === req.user.id)
        );
        const lastMessage = conversationMsgs[conversationMsgs.length - 1] || null;
        const unreadCount = conversationMsgs.filter(
          m => m.senderId === partnerId && m.status !== "read"
        ).length;

        convMap.set(partnerId, {
          partnerId,
          partnerName: partnerProfile?.name || partnerName,
          partnerAvatar: partnerProfile?.avatarUrl,
          partnerCity: partnerProfile?.city || r.senderCity || r.receiverCity,
          partnerBio: partnerProfile?.bio || "",
          exchangeId: r.id,
          skillOffered: r.skillOffered,
          skillRequested: r.skillRequested,
          status: r.status,
          lastMessage,
          unreadCount,
          updatedAt: lastMessage?.createdAt || r.createdAt
        });
      }
    }

    res.json(Array.from(convMap.values()));
  });

  // Get Messages for a specific partner (strictly authenticated to accepted exchanges)
  app.get("/api/messages", (req, res) => {
    const partnerId = req.query.partnerId as string;
    if (!partnerId) {
      return res.json([]);
    }

    // Privacy & authorization rule: only users with accepted/completed exchange can communicate
    if (!isExchangeAccepted(req.user.id, partnerId)) {
      return res.status(403).json({ 
        error: "Privacy restriction: Only members with an accepted Skill Exchange can view or send messages." 
      });
    }

    const filtered = messages.filter(
      m => (m.senderId === req.user.id && m.receiverId === partnerId) ||
           (m.senderId === partnerId && m.receiverId === req.user.id)
    );

    // Mark unread messages sent by partner as read
    const unreadIds: string[] = [];
    for (const m of filtered) {
      if (m.senderId === partnerId && m.status !== "read") {
        m.status = "read";
        unreadIds.push(m.id);
      }
    }
    if (unreadIds.length > 0) {
      saveMessagesToDisk();
      broadcastStatusUpdate(partnerId, unreadIds, "read");
    }

    res.json(filtered);
  });

  // Send Message (strictly validated to accepted exchanges)
  app.post("/api/messages", (req, res) => {
    const { receiverId, text, mediaUrl, mediaType, fileName, fileSize } = req.body;
    if (!receiverId || (!text && !mediaUrl)) {
      return res.status(400).json({ error: "Receiver and message content or attachment required" });
    }

    // Verify exchange status
    if (!isExchangeAccepted(req.user.id, receiverId)) {
      return res.status(403).json({ 
        error: "Communication restricted: You can only message members after a Skill Exchange request has been accepted." 
      });
    }

    const now = new Date();
    const newMsg: ChatMessage = {
      id: "msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      senderId: req.user.id,
      senderName: req.user.name,
      receiverId,
      text: (text || "").trim(),
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaType || undefined,
      fileName: fileName || undefined,
      fileSize: fileSize || undefined,
      createdAt: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: now.getTime(),
      status: "delivered"
    };

    messages.push(newMsg);
    saveMessagesToDisk();
    broadcastMessage(newMsg);

    const partnerUser = users.find(u => u.id === receiverId);
    addActivity(
      "new_message",
      "New message",
      `Sent message to ${partnerUser?.name || "Partner"}: "${(newMsg.text || "Attachment").slice(0, 45)}"`,
      receiverId,
      partnerUser?.name
    );

    res.json(newMsg);
  });

  // Mark messages as read
  app.post("/api/messages/read", (req, res) => {
    const { partnerId } = req.body;
    if (!partnerId) {
      return res.status(400).json({ error: "Partner ID required" });
    }

    const unreadIds: string[] = [];
    for (const m of messages) {
      if (m.senderId === partnerId && m.receiverId === req.user.id && m.status !== "read") {
        m.status = "read";
        unreadIds.push(m.id);
      }
    }

    if (unreadIds.length > 0) {
      saveMessagesToDisk();
      broadcastStatusUpdate(partnerId, unreadIds, "read");
    }

    res.json({ success: true, count: unreadIds.length });
  });

  // Delete single message (and its attached media on disk)
  app.delete("/api/messages/:id", (req, res) => {
    const { id } = req.params;
    const msgIndex = messages.findIndex(m => m.id === id);
    if (msgIndex === -1) {
      return res.status(404).json({ error: "Message not found" });
    }

    const targetMsg = messages[msgIndex];
    if (targetMsg.mediaUrl) {
      deleteUploadedMediaFile(targetMsg.mediaUrl);
    }

    messages.splice(msgIndex, 1);
    saveMessagesToDisk();

    // Broadcast SSE deletion event
    broadcastMessageDelete(id, targetMsg.senderId, targetMsg.receiverId);

    res.json({ success: true, messageId: id });
  });

  // Delete media attachment only from a message
  app.delete("/api/messages/:id/media", (req, res) => {
    const { id } = req.params;
    const targetMsg = messages.find(m => m.id === id);
    if (!targetMsg) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (targetMsg.mediaUrl) {
      deleteUploadedMediaFile(targetMsg.mediaUrl);
    }

    // If message has no remaining text, delete the entire message
    if (!targetMsg.text || targetMsg.text.trim() === "") {
      messages = messages.filter(m => m.id !== id);
      saveMessagesToDisk();
      broadcastMessageDelete(id, targetMsg.senderId, targetMsg.receiverId);
      return res.json({ success: true, messageDeleted: true, messageId: id });
    } else {
      delete (targetMsg as any).mediaUrl;
      delete (targetMsg as any).mediaType;
      delete (targetMsg as any).fileName;
      delete (targetMsg as any).fileSize;
      saveMessagesToDisk();
      broadcastMessageUpdate(targetMsg);
      return res.json({ success: true, messageDeleted: false, message: targetMsg });
    }
  });

  // Clear conversation messages and associated media files
  app.delete("/api/messages", (req, res) => {
    const partnerId = req.query.partnerId as string;
    if (partnerId) {
      const toDelete = messages.filter(
        m => m.senderId === partnerId || m.receiverId === partnerId
      );
      for (const m of toDelete) {
        if (m.mediaUrl) {
          deleteUploadedMediaFile(m.mediaUrl);
        }
      }
      messages = messages.filter(
        m => !(m.senderId === partnerId || m.receiverId === partnerId)
      );
    } else {
      for (const m of messages) {
        if (m.mediaUrl) {
          deleteUploadedMediaFile(m.mediaUrl);
        }
      }
      messages = [];
    }
    saveMessagesToDisk();
    res.json({ success: true });
  });

  // Progress & Streak
  app.get("/api/progress", (req, res) => {
    res.json(getProgress(req.user.id));
  });

  app.post("/api/progress/log", (req, res) => {
    const { minutes } = req.body;
    const mins = Number(minutes) || 30;
    const today = new Date().toISOString().split("T")[0];
    const existingLog = getProgress(req.user.id).logs.find(l => l.date === today);
    if (existingLog) {
      existingLog.minutes += mins;
    } else {
      getProgress(req.user.id).logs.push({ date: today, minutes: mins });
      getProgress(req.user.id).currentStreak += 1;
      if (getProgress(req.user.id).currentStreak > getProgress(req.user.id).longestStreak) {
        getProgress(req.user.id).longestStreak = getProgress(req.user.id).currentStreak;
      }
    }
    getProgress(req.user.id).minutesThisWeek += mins;
    res.json(getProgress(req.user.id));
  });

  app.post("/api/progress/goals", (req, res) => {
    const { skill, targetLevel, steps, weeklyMinutes } = req.body;
    if (!skill) return res.status(400).json({ error: "Skill is required" });
    const goal: LearningGoal = {
      id: "goal-" + Date.now(),
      skill,
      targetLevel: targetLevel || "Intermediate",
      steps: Number(steps) || 10,
      completedSteps: 0,
      weeklyMinutes: Number(weeklyMinutes) || 120
    };
    getProgress(req.user.id).goals.push(goal);
    res.json(getProgress(req.user.id));
  });

  app.delete("/api/progress/goals/:id", (req, res) => {
    getProgress(req.user.id).goals = getProgress(req.user.id).goals.filter(g => g.id !== req.params.id);
    res.json(getProgress(req.user.id));
  });

  // WebRTC Signaling
  app.post("/api/webrtc/:roomId/signal", (req, res) => {
    const { roomId } = req.params;
    const signal: WebRTCSignal = req.body;
    if (!webrtcRooms[roomId]) {
      webrtcRooms[roomId] = [];
    }
    webrtcRooms[roomId].push(signal);
    // Keep max 50 signals
    if (webrtcRooms[roomId].length > 50) {
      webrtcRooms[roomId].shift();
    }
    res.json({ success: true });
  });

  app.get("/api/webrtc/:roomId/signals", (req, res) => {
    const { roomId } = req.params;
    const since = Number(req.query.since) || 0;
    const signals = webrtcRooms[roomId] || [];
    res.json(signals.slice(since));
  });

  app.post("/api/webrtc/:roomId/clear", (req, res) => {
    const { roomId } = req.params;
    delete webrtcRooms[roomId];
    res.json({ success: true });
  });

  // AI Skill Match (Gemini API)
  app.post("/api/ai/skill-match", async (req, res) => {
    const { skillWanted, goal } = req.body;
    if (!skillWanted) {
      return res.status(400).json({ error: "Skill you want to learn is required" });
    }

    const genAI = getGenAI();
    if (!genAI) {
      // Honest state when AI is not configured with key
      return res.status(503).json({
        error: "AI service is currently unavailable. Please verify GEMINI_API_KEY.",
        isAvailable: false
      });
    }

    try {
      // Send real community members info to Gemini to analyze and find authentic match
      const availableMembers = users.filter(u => u.id !== req.user.id).map(u => ({
        id: u.id,
        name: u.name,
        city: u.city,
        teaches: u.teachSkills.map(s => `${s.name} (${s.level || "Any level"})`),
        learns: u.learnSkills.map(s => s.name),
        bio: u.bio
      }));

      const prompt = `You are the AI Matcher for ShareSkill Cloud. A user wants to learn "${skillWanted}".
Their specific goal: "${goal || "General mastery"}".
Here is the list of real community members:
${JSON.stringify(availableMembers, null, 2)}

Match and recommend the best mentors strictly from the list above. Do NOT invent new members.
Return JSON with this schema:
{
  "recommendations": [
    {
      "memberId": "string",
      "memberName": "string",
      "matchScore": number (1-100),
      "rationale": "Brief reason why they match their goal",
      "suggestedStartingTopic": "string"
    }
  ],
  "advice": "Short learning tip for this goal"
}`;

      const response = await genAI.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);
      res.json({ isAvailable: true, ...parsed });
    } catch (err: any) {
      console.error("AI Skill Match Error:", err);
      res.status(500).json({ error: err.message || "Failed to process AI Skill Match" });
    }
  });

  // AI Career Advisor (Gemini API)
  app.post("/api/ai/career-advisor", async (req, res) => {
    const { careerGoal, horizonMonths } = req.body;
    if (!careerGoal) {
      return res.status(400).json({ error: "Career goal is required" });
    }

    const genAI = getGenAI();
    if (!genAI) {
      return res.status(503).json({
        error: "AI service is currently unavailable. Please configure GEMINI_API_KEY in settings.",
        isAvailable: false
      });
    }

    try {
      const userSkillsTeach = req.user.teachSkills.map(s => `${s.name} (${s.level || "Intermediate"})`).join(", ") || "None";
      const userSkillsLearn = req.user.learnSkills.map(s => `${s.name} (${s.level || "Beginner"})`).join(", ") || "None";

      const prompt = `You are the AI Career Advisor for ShareSkill Cloud.
User current profile:
- Name: ${req.user.name}
- Skills they can teach: ${userSkillsTeach}
- Skills they want to learn: ${userSkillsLearn}
- Career Goal: "${careerGoal}"
- Time Horizon: ${horizonMonths || 12} months

Create a concrete, high-impact career progression roadmap. Map the path from their current skill set to their desired career goal over the specified horizon.
Return JSON with this schema:
{
  "goal": "${careerGoal}",
  "horizonMonths": ${Number(horizonMonths) || 12},
  "summary": "High-level strategy summary",
  "milestones": [
    {
      "phase": "Phase 1 (Months 1-3)",
      "title": "Core Foundations & Bridge",
      "duration": "3 months",
      "skillsToAcquire": ["Skill 1", "Skill 2"],
      "recommendedProjects": ["Project 1", "Project 2"]
    }
  ],
  "suggestedMentors": ["Skill type to search in community"]
}`;

      const response = await genAI.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "{}";
      const plan = JSON.parse(responseText);
      res.json({ isAvailable: true, plan });
    } catch (err: any) {
      console.error("AI Career Advisor Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate career plan" });
    }
  });

  // AI Resume Builder (Gemini API)
  app.post("/api/ai/resume", async (req, res) => {
    const { targetRole } = req.body;
    const genAI = getGenAI();
    if (!genAI) {
      return res.status(503).json({
        error: "AI service is currently unavailable. Please configure GEMINI_API_KEY in settings.",
        isAvailable: false
      });
    }

    try {
      const userSkillsTeach = req.user.teachSkills.map(s => s.name).join(", ");
      const userSkillsLearn = req.user.learnSkills.map(s => s.name).join(", ");
      const completedExchanges = requests
        .filter(r => r.status === "completed")
        .map(r => `${r.skillOffered} exchanged for ${r.skillRequested}`)
        .join("; ");

      const prompt = `You are the AI Resume Builder for ShareSkill Cloud.
User details:
- Full Name: ${req.user.name}
- Location: ${req.user.city}, ${req.user.country}
- Bio: ${req.user.bio}
- Skills Taught / Mentored: ${userSkillsTeach}
- Skills Learned: ${userSkillsLearn}
- Verified Completed Peer Exchanges: ${completedExchanges || "Several 1-on-1 peer learning exchanges"}
- Target Role: "${targetRole || "Software Developer"}"

Build a professional, modern resume outline highlighting both technical competency and peer-teaching/collaboration leadership.
Return JSON with this schema:
{
  "targetRole": "${targetRole || "Software Developer"}",
  "summary": "Professional executive summary statement",
  "coreCompetencies": ["string"],
  "skillsTaught": ["string"],
  "skillsLearned": ["string"],
  "completedExchanges": ["string"],
  "suggestedActionItems": ["string"]
}`;

      const response = await genAI.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "{}";
      const resume = JSON.parse(responseText);
      res.json({ isAvailable: true, resume });
    } catch (err: any) {
      console.error("AI Resume Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate resume" });
    }
  });

  // Vite middleware or static serving
  if (process.env.NODE_ENV !== "production") {
    // Keep development-only Vite code out of the Netlify Function bundle. Using
    // a variable import prevents the function bundler from traversing Vite and
    // its optional development dependencies.
    const vitePackage = "vite";
    const { createServer: createViteServer } = await import(vitePackage);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        port: 3000,
        strictPort: true,
        cors: true,
        allowedHosts: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ShareSkill Cloud server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NETLIFY !== "true" && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer().catch(err => {
    console.error("Server startup error:", err);
  });
}
