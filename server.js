// Chatify server: zero dependencies, Node 18+. Run: ADMIN_CODE=yourcode node server.js
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = +process.env.SERVER_PORT || +process.env.PORT || 3000, DATA = process.env.DATA_DIR || path.join(__dirname, "data");
const ADMIN_CODE = process.env.ADMIN_CODE || "9912";
const FILE = path.join(DATA, "db.json"), PUB = path.join(__dirname, "public"), UP = path.join(DATA, "uploads");
fs.mkdirSync(UP, { recursive: true });

let db = { users: {}, sessions: {}, servers: {}, channels: {}, messages: {}, files: {}, config: { banned: [], ann: null } };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(FILE, "utf8"))); } catch (e) {}
const defTag = n => { const t = String(n).replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase(); return t.length < 2 ? "SRV" : t; };
db.servers.chatify ||= { id: "chatify", name: "Chatify", owner: "admin", code: "Chatify", tag: "CHAT", members: {}, roles: {}, t: 0 };
db.servers.chatify.owner = "admin"; db.servers.chatify.code = "Chatify"; // the "admin" account owns the main server
for (const s of Object.values(db.servers)) s.tag ||= defTag(s.name);
db.channels.general ||= { id: "general", server: "chatify", name: "General", private: false, roles: [], t: 0 };
for (const c of Object.values(db.channels)) { c.server ||= "chatify"; if (c.members) { c.roles = []; delete c.members; } c.roles ||= []; } // old private channels stay hidden
for (const l in db.users) db.servers.chatify.members[l] ||= [];
let timer; const save = () => { clearTimeout(timer); timer = setTimeout(() => { fs.writeFileSync(FILE + ".tmp", JSON.stringify(db)); fs.renameSync(FILE + ".tmp", FILE); }, 200); };
save();

const L = s => String(s).toLowerCase(), rid = n => crypto.randomBytes(n).toString("hex");
const scrypt = (p, s) => crypto.scryptSync(p, s, 64).toString("hex");
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const hits = {}, limited = (k, max, ms) => { const n = Date.now(); hits[k] = (hits[k] || []).filter(t => n - t < ms); if (hits[k].length >= max) return true; hits[k].push(n); return false; };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bannedWord = t => db.config.banned.find(w => new RegExp("(^|[^a-z0-9])" + esc(w) + "([^a-z0-9]|$)", "i").test(t));
const taken = (n, except) => Object.entries(db.users).some(([k, u]) => k !== except && (k === L(n) || L(u.display || "") === L(n)));
const BADGES = ["chatify_admin", "cook_ranger", "known"];

// can this user see (and type in) this channel?
const canSee = (u, c) => { const s = c && db.servers[c.server], m = s && s.members[L(u)]; return !!m && (!c.private || s.owner === L(u) || c.roles.some(r => m.includes(r))); };

const clients = new Set(), typing = {};
const push = (type, data, filter) => clients.forEach(c => { if (!filter || filter(c.user)) c.res.write(`event: ${type}\ndata: ${JSON.stringify(data || {})}\n\n`); });
const isOn = n => [...clients].some(c => c.user === n);
const tagOf = u => { const s = u.tagServer && db.servers[u.tagServer]; return s && s.members[L(u.name)] ? s.tag : ""; };
const people = () => Object.values(db.users).map(u => ({ user: u.name, display: u.display || u.name, desc: u.desc || "", avatar: !!u.avatar, av: u.avT || 0, badges: u.badges || [], tag: tagOf(u), tagServer: u.tagServer || "", online: isOn(u.name), typing: (typing[u.name] || 0) > Date.now() - 4000, msgs: u.msgs || 0 }));
let pt; const pres = () => { clearTimeout(pt); pt = setTimeout(() => push("presence", people()), 250); };
const notify = sid => push("servers", {}, u => !!db.servers[sid].members[L(u)]);
const view = u => Object.values(db.servers).filter(s => s.members[L(u)]).sort((a, b) => a.t - b.t).map(s => {
  const own = s.owner === L(u);
  return { id: s.id, name: s.name, tag: s.tag, own, code: own ? s.code : undefined, roles: Object.values(s.roles), my: s.members[L(u)],
    members: own ? Object.entries(s.members).map(([k, r]) => ({ user: db.users[k] ? db.users[k].name : k, roles: r })) : undefined,
    channels: Object.values(db.channels).filter(c => c.server === s.id && canSee(u, c)).sort((a, b) => a.t - b.t).map(c => ({ id: c.id, name: c.name, private: c.private, roles: own ? c.roles : undefined })) };
});

const send = (res, code, obj, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(JSON.stringify(obj)); };
const body = req => new Promise((ok, no) => { let d = ""; req.on("data", c => { d += c; if (d.length > 10000) { req.destroy(); no(); } }); req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch (e) { ok({}); } }); });
const raw = (req, max) => new Promise((ok, no) => { const a = []; let n = 0; req.on("data", c => { n += c.length; if (n > max) { req.destroy(); no(new Error("big")); } else a.push(c); }); req.on("end", () => ok(Buffer.concat(a))); req.on("error", no); });
const isHttps = req => req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
const cookie = (t, age, req) => `sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(age / 1000)}${isHttps(req) ? "; Secure" : ""}`;
const session = req => { const m = /(?:^|; )sid=([a-f0-9]+)/.exec(req.headers.cookie || ""); const s = m && db.sessions[m[1]]; if (!s || s.exp < Date.now()) return null; s.token = m[1]; return s; };
const startSession = (req, user) => { const t = rid(32); db.sessions[t] = { user, exp: Date.now() + 30 * 864e5, admin: 0 }; save(); return cookie(t, 30 * 864e5, req); };

// images: only real png / jpg / webp (checked by file signature, not just the name)
const MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const sniff = b => b.length < 12 ? null : (b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") ? "png" : (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ? "jpg" : (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") ? "webp" : null;
async function saveImg(req, res, name, max) {
  const buf = await raw(req, max).catch(() => null);
  if (!buf) { send(res, 413, { error: "File too big." }); return null; }
  const ext = sniff(buf), claimed = path.extname(name).slice(1).toLowerCase().replace("jpeg", "jpg");
  if (!ext || ext !== claimed) { send(res, 400, { error: "Only real .png, .jpg and .webp images are allowed." }); return null; }
  const id = rid(12); fs.writeFileSync(path.join(UP, id + "." + ext), buf); return { id, ext, size: buf.length };
}
const dropFile = id => { const f = db.files[id]; if (f) { fs.unlink(path.join(UP, id + "." + f.ext), () => {}); delete db.files[id]; } };
function serve(res, id, dl) {
  const f = db.files[id], p = f && path.join(UP, id + "." + f.ext);
  if (!p || !fs.existsSync(p)) return send(res, 404, { error: "Not found." });
  const h = { "content-type": MIME[f.ext], "cache-control": "private, max-age=86400" };
  if (dl) h["content-disposition"] = `attachment; filename="${f.name || "image." + f.ext}"`;
  res.writeHead(200, h); fs.createReadStream(p).pipe(res);
}
const cleanName = n => String(n || "image").replace(/[^\w. -]/g, "_").slice(-60);

async function api(req, res, url) {
  const ip = req.socket.remoteAddress, r = url.pathname.slice(5), post = req.method === "POST", isRaw = r === "upload" || r === "profile/avatar";
  const b = post && !isRaw ? await body(req) : {};
  if (r === "signup" || r === "login") {
    if (limited("auth" + ip, 10, 60000)) return send(res, 429, { error: "Too many attempts. Wait a minute." });
    const name = String(b.username || "").trim(), pw = String(b.password || ""), l = L(name);
    if (r === "signup") {
      if (!/^[a-z0-9_]{3,20}$/i.test(name)) return send(res, 400, { error: "Username: 3–20 letters, numbers or underscores." });
      if (pw.length < 6) return send(res, 400, { error: "Password must be at least 6 characters." });
      if (l === "admin" && !(ADMIN_CODE && same(String(b.code || ""), ADMIN_CODE))) return send(res, 403, { error: "The name “admin” is reserved. Enter the admin code to use it." });
      if (taken(name, null)) return send(res, 409, { error: "That name is already taken." });
      const salt = rid(16);
      db.users[l] = { name, salt, hash: scrypt(pw, salt), t: Date.now(), badges: [] };
    }
    const u = db.users[l];
    if (!u || !same(u.hash, scrypt(pw, u.salt))) return send(res, 401, { error: "Wrong username or password." });
    db.servers.chatify.members[l] ||= [];
    return send(res, 200, { name: u.name }, { "set-cookie": startSession(req, l) });
  }
  if (r === "config") return send(res, 200, { ann: db.config.ann }); // public: shown on the login screen too
  const s = session(req);
  if (!s) return send(res, 401, { error: "Please log in." });
  const user = db.users[s.user].name, l = s.user, admin = s.admin > Date.now();
  if (r === "me") return send(res, 200, { name: user, admin });
  if (r === "logout") { delete db.sessions[s.token]; save(); return send(res, 200, {}, { "set-cookie": cookie("", 0, req) }); }
  if (r === "events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    const c = { res, user }; clients.add(c); res.write(": ok\n\n"); pres(); req.on("close", () => { clients.delete(c); pres(); }); return;
  }
  if (r === "people") return send(res, 200, people());
  if (r === "typing") { if (canSee(user, db.channels[b.ch])) { typing[user] = Date.now(); pres(); } return send(res, 200, {}); }

  // profile
  if (r === "profile") {
    const u = db.users[l], d = String(b.display || "").trim(), desc = String(b.desc || "").trim().slice(0, 200);
    if (d) {
      if (!/^[\p{L}\p{N} _.-]{2,24}$/u.test(d)) return send(res, 400, { error: "Display name: 2–24 letters, numbers, spaces, _ . -" });
      if ((L(d) === "admin" && l !== "admin") || taken(d, l)) return send(res, 409, { error: "That name is already taken." });
      if (bannedWord(d)) return send(res, 400, { error: "That name contains a banned word." });
      u.display = d;
    } else delete u.display;
    if (bannedWord(desc)) return send(res, 400, { error: "Your description contains a banned word." });
    if ("tagServer" in b) { const ts = db.servers[b.tagServer]; if (!b.tagServer) delete u.tagServer; else if (ts && ts.members[l]) u.tagServer = b.tagServer; else return send(res, 400, { error: "You are not in that server." }); }
    u.desc = desc; save(); pres(); return send(res, 200, {});
  }
  if (r === "profile/avatar") {
    const f = await saveImg(req, res, cleanName(url.searchParams.get("name")), 1e6); if (!f) return;
    const u = db.users[l]; if (u.avatar) dropFile(u.avatar);
    db.files[f.id] = { owner: user, ext: f.ext, avatar: 1 }; u.avatar = f.id; u.avT = Date.now(); save(); pres(); return send(res, 200, {});
  }
  if (r.startsWith("avatar/")) { const u = db.users[L(r.slice(7))]; return u && u.avatar ? serve(res, u.avatar) : send(res, 404, {}); }
  if (r.startsWith("file/")) { const id = r.slice(5), f = db.files[id]; return f && !f.avatar && canSee(user, db.channels[f.ch]) ? serve(res, id, url.searchParams.get("dl")) : send(res, 404, { error: "Not found." }); }
  if (r === "badges") {
    if (l !== "admin") return send(res, 403, { error: "Only the admin account can give badges." });
    const t = db.users[L(b.user)]; if (!t || !BADGES.includes(b.badge)) return send(res, 400, { error: "Bad request." });
    const set = new Set(t.badges || []); if (b.on) set.add(b.badge); else set.delete(b.badge);
    t.badges = [...set]; save(); pres(); return send(res, 200, {});
  }

  // servers, roles, channels
  const mine = () => { const sv = db.servers[b.server]; return sv && sv.owner === l ? sv : null; };
  if (r === "servers" && !post) return send(res, 200, view(user));
  if (r === "servers") {
    const name = String(b.name || "").trim().slice(0, 30);
    if (name.length < 2) return send(res, 400, { error: "Server name must be at least 2 characters." });
    if (Object.values(db.servers).filter(x => x.owner === l).length >= 5) return send(res, 400, { error: "You can own up to 5 servers." });
    const id = rid(5), cid = rid(5), code = rid(3).toUpperCase();
    db.servers[id] = { id, name, owner: l, code, members: { [l]: [] }, roles: {}, tag: defTag(name), t: Date.now() };
    db.channels[cid] = { id: cid, server: id, name: "general", private: false, roles: [], t: Date.now() }; save(); notify(id); return send(res, 200, { id });
  }
  if (r === "servers/join") {
    if (limited("join" + user, 10, 60000)) return send(res, 429, { error: "Too many tries. Wait a minute." });
    const code = String(b.code || "").trim(), sv = Object.values(db.servers).find(x => x.code && L(x.code) === L(code));
    if (!sv) return send(res, 404, { error: "Invalid join code." });
    sv.members[l] ||= []; save(); notify(sv.id); return send(res, 200, { id: sv.id });
  }
  if (r.startsWith("servers/")) {
    const sv = mine(); if (!sv) return send(res, 403, { error: "Only the server owner can do that." });
    if (r === "servers/role") {
      const name = String(b.name || "").trim().slice(0, 20), color = /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#6c4cf5";
      if (!name) return send(res, 400, { error: "Enter a role name." });
      if (Object.keys(sv.roles).length >= 20) return send(res, 400, { error: "Up to 20 roles." });
      const id = rid(4); sv.roles[id] = { id, name, color };
    } else if (r === "servers/role/delete") {
      delete sv.roles[b.role]; for (const k in sv.members) sv.members[k] = sv.members[k].filter(x => x !== b.role);
      for (const c of Object.values(db.channels)) if (c.server === sv.id) c.roles = c.roles.filter(x => x !== b.role);
    } else if (r === "servers/assign") {
      const k = L(b.user), m = sv.members[k]; if (!m || !sv.roles[b.role]) return send(res, 400, { error: "Bad request." });
      sv.members[k] = b.on ? [...new Set([...m, b.role])] : m.filter(x => x !== b.role);
    } else if (r === "servers/channel") {
      const name = String(b.name || "").trim().slice(0, 30); if (!name) return send(res, 400, { error: "Enter a channel name." });
      if (Object.values(db.channels).filter(c => c.server === sv.id).length >= 30) return send(res, 400, { error: "Up to 30 channels." });
      const id = rid(5); db.channels[id] = { id, server: sv.id, name, private: !!b.private, roles: (Array.isArray(b.roles) ? b.roles : []).filter(x => sv.roles[x]), t: Date.now() };
    } else if (r === "servers/edit") {
      const name = String(b.name ?? sv.name).trim().slice(0, 30), tag = String(b.tag ?? sv.tag).trim();
      if (name.length < 2) return send(res, 400, { error: "Server name must be at least 2 characters." });
      if (!/^[A-Za-z0-9]{2,5}$/.test(tag)) return send(res, 400, { error: "Tag: 2–5 letters or numbers." });
      if (bannedWord(name) || bannedWord(tag)) return send(res, 400, { error: "That contains a banned word." });
      sv.name = name; sv.tag = tag; pres();
    } else if (r === "servers/delete") {
      if (sv.id === "chatify") return send(res, 400, { error: "The main Chatify server can’t be deleted." });
      const mem = Object.keys(sv.members);
      for (const c of Object.values(db.channels)) if (c.server === sv.id) { (db.messages[c.id] || []).forEach(m => m.file && dropFile(m.file.id)); delete db.messages[c.id]; delete db.channels[c.id]; }
      delete db.servers[sv.id]; save(); push("servers", {}, u => mem.includes(L(u))); pres(); return send(res, 200, {});
    } else return send(res, 404, { error: "Not found." });
    save(); notify(sv.id); return send(res, 200, {});
  }

  // messages and files
  if (r === "messages" && !post) {
    const id = url.searchParams.get("ch");
    if (!canSee(user, db.channels[id])) return send(res, 403, { error: "No access." });
    return send(res, 200, (db.messages[id] || []).slice(-100));
  }
  const add = (c, m) => { (db.messages[c.id] ||= []).push(m); if (db.messages[c.id].length > 1000) { const o = db.messages[c.id].shift(); if (o.file) dropFile(o.file.id); } db.users[l].msgs = (db.users[l].msgs || 0) + 1; delete typing[user]; save(); push("msg", { ch: c.id, msg: m }, u => canSee(u, c)); pres(); };
  if (r === "messages") {
    const c = db.channels[b.ch], text = String(b.text || "").trim().slice(0, 500);
    if (!canSee(user, c)) return send(res, 403, { error: "No access." });
    if (!text) return send(res, 400, { error: "Empty message." });
    if (limited("msg" + user, 5, 5000)) return send(res, 429, { error: "Slow down a little." });
    if (bannedWord(text)) return send(res, 400, { error: "Your message contains a banned word and wasn’t sent." });
    add(c, { id: rid(6), user, text, t: Date.now() }); return send(res, 200, {});
  }
  if (r === "upload") {
    const c = db.channels[url.searchParams.get("ch")], name = cleanName(url.searchParams.get("name"));
    if (!canSee(user, c)) return send(res, 403, { error: "No access." });
    if (limited("up" + user, 5, 30000)) return send(res, 429, { error: "Slow down a little." });
    if (bannedWord(name)) return send(res, 400, { error: "That file name contains a banned word." });
    const f = await saveImg(req, res, name, 5e6); if (!f) return;
    db.files[f.id] = { ch: c.id, name, ext: f.ext, owner: user, size: f.size };
    add(c, { id: rid(6), user, text: "", t: Date.now(), file: { id: f.id, name, size: f.size } }); return send(res, 200, {});
  }
  if (r === "messages/delete") {
    const c = db.channels[b.ch];
    if (!canSee(user, c)) return send(res, 403, { error: "No access." });
    const list = db.messages[c.id] || [], i = list.findIndex(m => m.id === b.id);
    if (i < 0) return send(res, 404, { error: "Message not found." });
    if (list[i].user !== user) return send(res, 403, { error: "You can only delete your own messages." });
    if (list[i].file) dropFile(list[i].file.id);
    list.splice(i, 1); save(); push("del", { ch: c.id, id: b.id }, u => canSee(u, c)); return send(res, 200, {});
  }

  // admin panel
  if (r === "admin/unlock") {
    if (limited("adm" + ip, 5, 60000)) return send(res, 429, { error: "Too many attempts." });
    if (!ADMIN_CODE) return send(res, 503, { error: "Admin is disabled: set the ADMIN_CODE environment variable." });
    if (!same(String(b.code || ""), ADMIN_CODE)) return send(res, 401, { error: "Wrong code." });
    s.admin = Date.now() + 36e5; save(); return send(res, 200, {});
  }
  if (r.startsWith("admin/")) {
    if (!admin) return send(res, 403, { error: "Admin locked." });
    if (r === "admin/state") return send(res, 200, { banned: db.config.banned });
    if (r === "admin/announce") { const t = String(b.text || "").trim().slice(0, 300); db.config.ann = t ? { text: t, t: Date.now(), by: user } : null; save(); push("config"); return send(res, 200, {}); }
    if (r === "admin/banned") {
      const w = String(b.word || "").trim().toLowerCase().slice(0, 40), set = new Set(db.config.banned);
      if (b.remove) set.delete(w); else if (w) set.add(w);
      db.config.banned = [...set]; save(); return send(res, 200, { banned: db.config.banned });
    }
  }
  send(res, 404, { error: "Not found." });
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".txt": "text/plain", ".json": "application/json" };
http.createServer(async (req, res) => {
  res.setHeader("x-content-type-options", "nosniff"); res.setHeader("x-frame-options", "DENY"); res.setHeader("referrer-policy", "same-origin");
  res.setHeader("content-security-policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:");
  if (isHttps(req)) res.setHeader("strict-transport-security", "max-age=31536000");
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/health") return send(res, 200, { ok: true });
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    let f = path.normalize(path.join(PUB, url.pathname === "/" ? "index.html" : url.pathname));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUB, "index.html");
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  } catch (e) { if (!res.headersSent) send(res, 500, { error: "Server error." }); }
}).listen(PORT, "0.0.0.0", () => console.log(`Chatify running on http://localhost:${PORT}${ADMIN_CODE ? "" : "  (ADMIN_CODE not set: admin panel disabled)"}`));
setInterval(() => { clients.forEach(c => c.res.write(": hb\n\n")); const n = Date.now(); for (const t in db.sessions) if (db.sessions[t].exp < n) delete db.sessions[t]; }, 25000);
setInterval(() => { let ch = 0; for (const k in typing) if (Date.now() - typing[k] > 4000) { delete typing[k]; ch = 1; } if (ch) pres(); }, 2000);
