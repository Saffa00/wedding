import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const { PORT = 4000, APP_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM } = process.env;
if (!APP_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_URL.includes("YOUR-PROJECT")) {
  console.error("\n========================================================");
  console.error("❌ SERVER CONFIGURATION ERROR");
  console.error("========================================================");
  console.error("Missing or incomplete environment variables in server/.env:\n");
  if (!APP_URL) console.error(" • APP_URL: URL of your frontend (e.g. http://localhost:5173)");
  if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR-PROJECT")) console.error(" • SUPABASE_URL: Project URL from Supabase Settings > API");
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error(" • SUPABASE_SERVICE_ROLE_KEY: Secret service_role key from Supabase Settings > API");
  console.error("\nPlease update server/.env with your real Supabase credentials.");
  console.error("========================================================\n");
  throw new Error("Missing or incomplete configuration in server/.env (APP_URL, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY)");
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const app = express();
app.set("trust proxy", 1);
app.use(helmet());

const allowedOrigins = [
  APP_URL.replace(/\/$/, ""),
  "http://localhost:5173",
  "http://localhost:5174",
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const clean = origin.replace(/\/$/, "");
    if (allowedOrigins.includes(clean) || clean.endsWith(".vercel.app") || clean.endsWith(".onrender.com")) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "20kb" }));
// Private data must never sit in shared caches
app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120 }));
const publicLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

/* ---------- helpers ---------- */

const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");
const newToken = () => crypto.randomBytes(24).toString("base64url");
const newRef = () => "WED-" + crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
// QR may hold a bare token or a full invitation link
const readToken = (v) => (typeof v === "string" ? v.trim().split("/").pop().split("?")[0] : "");
// PostgREST returns an object for one-to-one embeds and an array for one-to-many; accept both
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const requireRole = (...roles) => async (req, res, next) => {
  const jwt = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!jwt) return res.status(401).json({ error: "Sign in required." });
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) return res.status(401).json({ error: "Session expired. Sign in again." });
  if (data.user.banned_until && new Date(data.user.banned_until) > new Date()) return res.status(403).json({ error: "This account has been disabled." });
  const { data: profile } = await db.from("profiles").select("id, full_name, role").eq("id", data.user.id).single();
  if (!profile || !roles.includes(profile.role)) return res.status(403).json({ error: "You do not have access." });
  req.user = {
    ...profile,
    must_change_password: !!data.user.user_metadata?.must_change_password,
  };
  next();
};
const staff = requireRole("admin", "usher");
const admin = requireRole("admin");

const getSettings = async () => (await db.from("wedding_settings").select("*").maybeSingle()).data;

/* ---------- session ---------- */

app.get("/api/me", staff, (req, res) => res.json(req.user));

// Staff password change (e.g. usher changing temporary password on first sign in)
app.post("/api/me/password", staff, wrap(async (req, res) => {
  const password = req.body?.password;
  if (!okPassword(password)) return res.status(400).json({ error: "The password must be 10 to 72 characters." });
  const { error } = await db.auth.admin.updateUserById(req.user.id, {
    password,
    user_metadata: { must_change_password: false },
  });
  if (error) throw error;
  res.json({ ok: true });
}));

/* ---------- scanning (admin + ushers) ---------- */

app.post("/api/scan/verify", staff, wrap(async (req, res) => {
  const token = readToken(req.body?.token);
  if (!token) return res.status(400).json({ result: "invalid" });
  const { data, error } = await db.rpc("verify_invitation", { p_token_hash: hash(token) });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return res.status(404).json({ result: "invalid" });
  if (row.status === "revoked") return res.status(403).json({ result: "revoked" });
  res.json({ result: row.checked_in ? "already_checked_in" : "ready", ...row });
}));

app.post("/api/scan/check-in", staff, wrap(async (req, res) => {
  const token = readToken(req.body?.token);
  if (!token) return res.status(400).json({ result: "invalid" });
  const { data, error } = await db.rpc("check_in_guest", { p_token_hash: hash(token), p_usher_id: req.user.id });
  if (error) throw error;
  res.status(data.result === "success" ? 200 : 409).json(data);
}));

// Manual lookup: find a guest by name
app.get("/api/guests/search", staff, wrap(async (req, res) => {
  const q = String(req.query.q || "").trim().replace(/[%,()]/g, "");
  if (q.length < 2) return res.json([]);
  const { data, error } = await db
    .from("guests")
    .select("id, full_name, side, seating_tables(number), invitations(id, reference, status), check_ins(checked_in_at)")
    .ilike("full_name", `%${q}%`)
    .limit(20);
  if (error) throw error;
  res.json(data.map((g) => ({
    guestId: g.id, name: g.full_name, side: g.side,
    table: one(g.seating_tables)?.number ?? null,
    invitationId: one(g.invitations)?.id ?? null,
    reference: one(g.invitations)?.reference ?? null,
    status: one(g.invitations)?.status ?? "none",
    checkedInAt: one(g.check_ins)?.checked_in_at ?? null,
  })));
}));

// Manual check-in after a name search (still atomic, still server-side)
app.post("/api/scan/check-in-manual", staff, wrap(async (req, res) => {
  const { data: inv } = await db.from("invitations").select("token_hash").eq("id", req.body?.invitationId).single();
  if (!inv) return res.status(404).json({ result: "invalid" });
  const { data, error } = await db.rpc("check_in_guest", { p_token_hash: inv.token_hash, p_usher_id: req.user.id });
  if (error) throw error;
  res.status(data.result === "success" ? 200 : 409).json(data);
}));

app.get("/api/activity", staff, wrap(async (_req, res) => {
  const { data, error } = await db
    .from("check_ins")
    .select("checked_in_at, guests(full_name, side), profiles(full_name)")
    .order("checked_in_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  res.json(data.map((r) => ({
    checked_in_at: r.checked_in_at,
    guests: one(r.guests),
    profiles: one(r.profiles),
  })));
}));

/* ---------- admin ---------- */

app.get("/api/stats", staff, wrap(async (_req, res) => {
  const count = async (q) => (await q).count ?? 0;
  const head = { count: "exact", head: true };
  const [total, bride, groom, checked] = await Promise.all([
    count(db.from("guests").select("id", head)),
    count(db.from("guests").select("id", head).eq("side", "bride")),
    count(db.from("guests").select("id", head).eq("side", "groom")),
    count(db.from("check_ins").select("id", head)),
  ]);
  res.json({ total, bride, groom, checkedIn: checked, yetToArrive: total - checked });
}));

// Guest management
const GUEST_COLS = "id, full_name, side, phone, email, table_id, seating_tables(number), invitations(id, reference, status), check_ins(checked_in_at)";
const shapeGuest = (g) => {
  const inv = one(g.invitations);
  return {
    id: g.id, name: g.full_name, side: g.side, phone: g.phone, email: g.email,
    tableId: g.table_id, table: one(g.seating_tables)?.number ?? null,
    invitation: inv ? { id: inv.id, reference: inv.reference, status: inv.status } : null,
    checkedInAt: one(g.check_ins)?.checked_in_at ?? null,
  };
};
const cleanGuest = (b = {}, partial = false) => {
  const out = {};
  if (!partial || "name" in b) {
    const n = String(b.name ?? "").trim();
    if (!n || n.length > 120) return { error: "Enter the guest’s name (up to 120 characters)." };
    out.full_name = n;
  }
  if (!partial || "side" in b) {
    if (!["bride", "groom"].includes(b.side)) return { error: "Choose the bride’s side or the groom’s side." };
    out.side = b.side;
  }
  if ("phone" in b) {
    const p = String(b.phone ?? "").trim();
    if (p.length > 30) return { error: "Phone number is too long." };
    out.phone = p || null;
  }
  if ("email" in b) {
    const e = String(b.email ?? "").trim();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: "Enter a valid email address." };
    out.email = e || null;
  }
  if ("tableId" in b) out.table_id = b.tableId || null;
  return { value: out };
};
const guestWriteError = (res, error) => {
  if (/table is full/i.test(error.message)) return res.status(409).json({ error: "That table is full. Choose another table." });
  throw error;
};

app.get("/api/guests", admin, wrap(async (_req, res) => {
  const { data, error } = await db.from("guests").select(GUEST_COLS).order("full_name").limit(1000);
  if (error) throw error;
  res.json(data.map(shapeGuest));
}));

app.post("/api/guests", admin, wrap(async (req, res) => {
  const { value, error: bad } = cleanGuest(req.body);
  if (bad) return res.status(400).json({ error: bad });
  const { data, error } = await db.from("guests").insert(value).select(GUEST_COLS).single();
  if (error) return guestWriteError(res, error);
  res.status(201).json(shapeGuest(data));
}));

app.patch("/api/guests/:id", admin, wrap(async (req, res) => {
  const { value, error: bad } = cleanGuest(req.body, true);
  if (bad) return res.status(400).json({ error: bad });
  const { data, error } = await db.from("guests").update(value).eq("id", req.params.id).select(GUEST_COLS).single();
  if (error) return guestWriteError(res, error);
  res.json(shapeGuest(data));
}));

// Deleting a guest also removes their invitation and any check-in (cascade)
app.delete("/api/guests/:id", admin, wrap(async (req, res) => {
  const { error } = await db.from("guests").delete().eq("id", req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// Seating summary: capacity and how many guests are seated at each table
app.get("/api/tables", admin, wrap(async (_req, res) => {
  const { data, error } = await db
    .from("seating_tables").select("id, number, label, capacity, guests(count)").order("number");
  if (error) throw error;
  res.json(data.map((t) => ({ id: t.id, number: t.number, label: t.label, capacity: t.capacity, seated: t.guests?.[0]?.count ?? 0 })));
}));

// Table management
const cleanTable = (b = {}, partial = false) => {
  const out = {};
  if (!partial || "number" in b) {
    const n = Number(b.number);
    if (!Number.isInteger(n) || n < 1 || n > 999) return { error: "Table number must be a whole number from 1 to 999." };
    out.number = n;
  }
  if (!partial || "capacity" in b) {
    const c = Number(b.capacity);
    if (!Number.isInteger(c) || c < 1 || c > 100) return { error: "Seats must be a whole number from 1 to 100." };
    out.capacity = c;
  }
  if ("label" in b) {
    const l = String(b.label ?? "").trim();
    if (l.length > 40) return { error: "Label is too long. Use 40 characters or fewer." };
    out.label = l || null;
  }
  return { value: out };
};
const tableWriteError = (res, error) => {
  if (error.code === "23505") return res.status(409).json({ error: "That table number is already in use." });
  throw error;
};
const seatedAt = async (id) =>
  (await db.from("guests").select("id", { count: "exact", head: true }).eq("table_id", id)).count ?? 0;

app.post("/api/tables", admin, wrap(async (req, res) => {
  const { value, error: bad } = cleanTable(req.body);
  if (bad) return res.status(400).json({ error: bad });
  const { data, error } = await db.from("seating_tables").insert(value).select("id, number, label, capacity").single();
  if (error) return tableWriteError(res, error);
  res.status(201).json({ ...data, seated: 0 });
}));

app.patch("/api/tables/:id", admin, wrap(async (req, res) => {
  const { value, error: bad } = cleanTable(req.body, true);
  if (bad) return res.status(400).json({ error: bad });
  const seated = await seatedAt(req.params.id);
  if (value.capacity !== undefined && value.capacity < seated) {
    return res.status(409).json({ error: `${seated} guests are seated at this table. Move some of them before reducing the seats.` });
  }
  const { data, error } = await db.from("seating_tables").update(value).eq("id", req.params.id).select("id, number, label, capacity").single();
  if (error) return tableWriteError(res, error);
  res.json({ ...data, seated });
}));

// Guests seated at a deleted table are kept and become unassigned
app.delete("/api/tables/:id", admin, wrap(async (req, res) => {
  const { error } = await db.from("seating_tables").delete().eq("id", req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// Create or rotate a guest's invitation. The token is shown once, then only its hash exists.
app.post("/api/invitations/:guestId/issue", admin, wrap(async (req, res) => {
  const { data: guest } = await db
    .from("guests").select("id, full_name, side, email, phone, seating_tables(number)")
    .eq("id", req.params.guestId).single();
  if (!guest) return res.status(404).json({ error: "Guest not found." });
  const settings = await getSettings();
  if (!settings) return res.status(409).json({ error: "Add the wedding details in Settings before creating invitations." });

  const token = newToken();
  const { data: existing } = await db.from("invitations").select("id, reference").eq("guest_id", guest.id).maybeSingle();
  const reference = existing?.reference ?? newRef();
  const { error } = await db.from("invitations").upsert(
    { guest_id: guest.id, reference, token_hash: hash(token), status: "active", revoked_at: null },
    { onConflict: "guest_id" }
  );
  if (error) throw error;

  const link = `${APP_URL}/i/${token}`;
  const text = `You are invited to the wedding of ${settings.bride_name} & ${settings.groom_name}. Your invitation: ${link}`;
  let emailed = false;
  if (req.body?.sendEmail && guest.email && resend) {
    await resend.emails.send({
      from: EMAIL_FROM, to: guest.email,
      subject: `Wedding invitation for ${guest.full_name}`,
      text,
    });
    emailed = true;
  }
  const cleanPhone = (guest.phone || "").replace(/\D/g, "");
  res.json({
    reference, link, emailed,
    share: {
      whatsapp: cleanPhone
        ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
        : `whatsapp://send?text=${encodeURIComponent(text)}`,
      whatsappWeb: cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`,
      sms: `sms:${guest.phone || ""}?body=${encodeURIComponent(text)}`,
      mailto: `mailto:${guest.email || ""}?subject=${encodeURIComponent("Wedding invitation")}&body=${encodeURIComponent(text)}`,
    },
  });
}));

app.post("/api/invitations/:id/revoke", admin, wrap(async (req, res) => {
  const { error } = await db.from("invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

/* ---------- public invitation page (guest has no account) ---------- */

app.get("/api/public/invitation/:token", publicLimiter, wrap(async (req, res) => {
  const token = readToken(req.params.token);
  const { data, error } = await db.rpc("verify_invitation", { p_token_hash: hash(token) });
  if (error) throw error;
  const inv = data?.[0];
  if (!inv || inv.status !== "active") return res.status(404).json({ error: "This invitation is not valid." });
  const s = await getSettings();
  if (!s) return res.status(503).json({ error: "The wedding details have not been set up yet." });
  res.json({
    guestName: inv.guest_name, side: inv.side, table: inv.table_number, reference: inv.reference,
    brideName: s.bride_name, groomName: s.groom_name, eventDate: s.event_date, venue: s.venue, timezone: s.timezone,
    qr: await QRCode.toDataURL(token, { width: 480, margin: 1, errorCorrectionLevel: "M",
      color: { dark: "#0B4D3A", light: "#FFFFFF" } }),
  });
}));

// Full attendance list for the administrator
app.get("/api/attendance", admin, wrap(async (_req, res) => {
  const { data, error } = await db
    .from("check_ins")
    .select("id, checked_in_at, guests(id, full_name, side, seating_tables(number)), profiles(full_name)")
    .order("checked_in_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  res.json(data.map((c) => ({
    id: c.id, checkedInAt: c.checked_in_at,
    guestId: one(c.guests)?.id, name: one(c.guests)?.full_name, side: one(c.guests)?.side,
    table: one(one(c.guests)?.seating_tables)?.number ?? null,
    usher: one(c.profiles)?.full_name ?? null,
  })));
}));

// Undo a mistaken check-in; the guest can then be checked in again
app.delete("/api/check-ins/:id", admin, wrap(async (req, res) => {
  const { error } = await db.from("check_ins").delete().eq("id", req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// Usher accounts (the administrator manages exactly two)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAN_FOREVER = "876000h";
const okPassword = (p) => typeof p === "string" && p.length >= 10 && p.length <= 72;
const usherProfile = async (id) =>
  (await db.from("profiles").select("id, full_name").eq("id", id).eq("role", "usher").maybeSingle()).data;
const shapeUsher = (p, u) => ({
  id: p.id, name: p.full_name, email: u?.email ?? "",
  disabled: !!(u?.banned_until && new Date(u.banned_until) > new Date()),
});

app.get("/api/ushers", admin, wrap(async (_req, res) => {
  const { data: rows, error } = await db.from("profiles").select("id, full_name").eq("role", "usher").order("created_at");
  if (error) throw error;
  const users = await Promise.all(rows.map(async (r) => (await db.auth.admin.getUserById(r.id)).data?.user));
  res.json(rows.map((r, i) => shapeUsher(r, users[i])));
}));

app.post("/api/ushers", admin, wrap(async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = req.body?.password;
  if (!name || name.length > 80) return res.status(400).json({ error: "Enter the usher’s name (up to 80 characters)." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!okPassword(password)) return res.status(400).json({ error: "The password must be 10 to 72 characters." });
  const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "usher");
  if ((count ?? 0) >= 2) return res.status(409).json({ error: "Both usher accounts already exist. Remove one to add another." });

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  if (error) return res.status(409).json({ error: /already|registered/i.test(error.message) ? "That email is already registered." : error.message });
  const { error: profileError } = await db.from("profiles").insert({ id: data.user.id, full_name: name, role: "usher" });
  if (profileError) { // roll back so no orphan login is left behind
    await db.auth.admin.deleteUser(data.user.id);
    return res.status(409).json({ error: "Could not create the account. Only two ushers are allowed." });
  }
  res.status(201).json(shapeUsher({ id: data.user.id, full_name: name }, data.user));
}));

app.patch("/api/ushers/:id", admin, wrap(async (req, res) => {
  const p = await usherProfile(req.params.id);
  if (!p) return res.status(404).json({ error: "Usher not found." });
  const b = req.body ?? {};
  const name = "name" in b ? String(b.name ?? "").trim() : null;
  if (name !== null && (!name || name.length > 80)) return res.status(400).json({ error: "Enter the usher’s name (up to 80 characters)." });
  if (b.password && !okPassword(b.password)) return res.status(400).json({ error: "The password must be 10 to 72 characters." });

  if (name !== null) {
    const { error } = await db.from("profiles").update({ full_name: name }).eq("id", p.id);
    if (error) throw error;
  }
  const attrs = {};
  if (b.password) {
    attrs.password = b.password;
    attrs.user_metadata = { must_change_password: true };
  }
  if ("disabled" in b) attrs.ban_duration = b.disabled ? BAN_FOREVER : "none";
  if (Object.keys(attrs).length) {
    const { error } = await db.auth.admin.updateUserById(p.id, attrs);
    if (error) throw error;
  }
  const user = (await db.auth.admin.getUserById(p.id)).data?.user;
  const { data: fresh } = await db.from("profiles").select("id, full_name").eq("id", p.id).single();
  res.json(shapeUsher(fresh, user));
}));

// An usher who has recorded check-ins is kept for the attendance history and can only be disabled
app.delete("/api/ushers/:id", admin, wrap(async (req, res) => {
  const p = await usherProfile(req.params.id);
  if (!p) return res.status(404).json({ error: "Usher not found." });
  const { count } = await db.from("check_ins").select("id", { count: "exact", head: true }).eq("usher_id", p.id);
  if (count) return res.status(409).json({ error: `${p.full_name} has recorded ${count} check-ins, so the account cannot be removed. Disable it instead.` });
  const { error } = await db.auth.admin.deleteUser(p.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// Wedding details (names, date, venue, time zone)
const validZone = (z) => { try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; } };

app.get("/api/settings", staff, wrap(async (_req, res) => {
  const s = await getSettings();
  res.json(s ? { brideName: s.bride_name, groomName: s.groom_name, eventDate: s.event_date, venue: s.venue, timezone: s.timezone } : null);
}));

app.put("/api/settings", admin, wrap(async (req, res) => {
  const b = req.body ?? {};
  const bride = String(b.brideName ?? "").trim(), groom = String(b.groomName ?? "").trim(), venue = String(b.venue ?? "").trim();
  const when = new Date(b.eventDate), zone = String(b.timezone ?? "").trim();
  if (!bride || bride.length > 80 || !groom || groom.length > 80) return res.status(400).json({ error: "Enter both names (up to 80 characters each)." });
  if (!venue || venue.length > 160) return res.status(400).json({ error: "Enter the venue (up to 160 characters)." });
  if (Number.isNaN(when.getTime())) return res.status(400).json({ error: "Enter a valid wedding date and time." });
  if (!validZone(zone)) return res.status(400).json({ error: "Choose a valid time zone, for example Africa/Freetown." });
  const { error } = await db.from("wedding_settings").upsert(
    { id: true, bride_name: bride, groom_name: groom, event_date: when.toISOString(), venue, timezone: zone }, { onConflict: "id" });
  if (error) throw error;
  res.json({ ok: true });
}));

app.get("/", (_req, res) => res.json({ service: "Berchelle Check-in API", status: "online", health: "/health" }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, "0.0.0.0", () => console.log(`API listening on :${PORT}`));
