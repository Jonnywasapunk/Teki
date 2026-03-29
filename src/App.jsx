// ─────────────────────────────────────────────────────────────────────────────
// TEKI — Personal Command Center
// Stack: React + Supabase (auth + database)
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

// ── SUPABASE CONFIG ── Replace these two values after creating your project ──
const SUPABASE_URL  = "https://sozhjtedrwlvusmlxxer.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvemhqdGVkcndsdnVzbWx4eGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTQwMzgsImV4cCI6MjA4OTc5MDAzOH0.3vvWidY-3u8rdnx7TYjPmTkQuy1lb8taRybz8OteBfU";

// Minimal Supabase client (no npm needed — works via CDN import in Vite)
// If using Vite: npm install @supabase/supabase-js
// Then replace this block with: import { createClient } from '@supabase/supabase-js'
// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
const supabase = (() => {
  const headers = (token) => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON,
    ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${SUPABASE_ANON}` }),
  });

  let _session = (() => {
    try { return JSON.parse(localStorage.getItem("teki_session")); } catch { return null; }
  })();

  const _saveSession = (s) => {
    _session = s;
    try {
      if (s) localStorage.setItem("teki_session", JSON.stringify(s));
      else localStorage.removeItem("teki_session");
    } catch {}
  };

  const auth = {
    signUp: async ({ email, password, options }) => {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ email, password, data: options?.data }),
      });
      const data = await r.json();
      if (data.access_token) _saveSession(data);
      return { data, error: data.error_description || data.msg || null };
    },
    signInWithPassword: async ({ email, password }) => {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (data.access_token) _saveSession(data);
      return { data, error: data.error_description || data.msg || null };
    },
    signOut: async () => { _saveSession(null); return { error: null }; },
    getSession: () => ({ data: { session: _session } }),
  };

  const from = (table) => {
    const base = `${SUPABASE_URL}/rest/v1/${table}`;
    const h = () => headers(_session?.access_token);
    return {
      select: (cols = "*") => ({
        eq: (col, val) => ({
          order: (c, o) =>
            fetch(`${base}?select=${cols}&${col}=eq.${encodeURIComponent(val)}&order=${c}.${o?.ascending === false ? "desc" : "asc"}`, { headers: h() })
              .then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data : [], error: null })),
          then: (cb) =>
            fetch(`${base}?select=${cols}&${col}=eq.${encodeURIComponent(val)}`, { headers: h() })
              .then(r => r.json()).then(data => cb({ data: Array.isArray(data) ? data : [], error: null })),
        }),
        order: (c, o) =>
          fetch(`${base}?select=${cols}&order=${c}.${o?.ascending === false ? "desc" : "asc"}`, { headers: h() })
            .then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data : [], error: null })),
        then: (cb) =>
          fetch(`${base}?select=${cols}`, { headers: h() })
            .then(r => r.json()).then(data => cb({ data: Array.isArray(data) ? data : [], error: null })),
      }),
      insert: (rows) =>
        fetch(base, {
          method: "POST",
          headers: { ...h(), Prefer: "return=representation" },
          body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
        }).then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data : [data], error: null })),
      update: (vals) => ({
        eq: (col, val) =>
          fetch(`${base}?${col}=eq.${encodeURIComponent(val)}`, {
            method: "PATCH",
            headers: { ...h(), Prefer: "return=representation" },
            body: JSON.stringify(vals),
          }).then(async r => {
            const text = await r.text();
            let data = null;
            try { data = text ? JSON.parse(text) : []; } catch { data = []; }
            return { data: Array.isArray(data) ? data : [], error: null };
          }),
      }),
      delete: () => ({
        eq: (col, val) =>
          fetch(`${base}?${col}=eq.${encodeURIComponent(val)}`, {
            method: "DELETE", headers: h(),
          }).then(() => ({ error: null })),
      }),
    };
  };

  return { auth, from };
})();

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  green: "#1B4332", greenMid: "#2D6A4F", greenLight: "#40916C",
  red: "#9B1D20", redLight: "#C1121F",
  cream: "#F5F0E8", creamDark: "#EDE8DC",
  gold: "#C9A84C", goldLight: "#E0C068",
  text: "#1A1A1A", textMid: "#4A4A4A", textLight: "#888",
  white: "#FFFFFF", border: "#D8D2C4",
};

const PROJECTS = [
  { id: "dcdv",     name: "DCDB / Zebra",              color: C.green },
  { id: "nemi",     name: "Nemi",                      color: C.greenMid },
  { id: "parra",    name: "Parra",                     color: C.greenLight },
  { id: "copadi",   name: "Copadi",                    color: C.red },
  { id: "epg",      name: "Eastern Point Global",      color: C.gold },
  { id: "ept",      name: "Eastern Point Trust",       color: "#B8860B" },
  { id: "kojtan",   name: "Kojtanchanej Productions",  color: C.redLight },
  { id: "walden",   name: "Walden Editora / Cabin 1",  color: "#6B4F3A" },
  { id: "della",    name: "Della",                     color: "#7B5EA7" },
  { id: "lattente", name: "Lattente Café",             color: "#C47F3A" },
  { id: "benito",   name: "Benito Coffee Roasters",    color: "#8B5E3C" },
  { id: "pupusas",  name: "PupusasBA",                 color: "#C1440E" },
  { id: "freshbrew",name: "Fresh Brew",                color: "#2E7D6B" },
  { id: "other",    name: "Other",                     color: C.textLight },
];

const STATUSES = ["New", "Contacted", "Follow-up", "Qualified", "Closed", "Not interested"];
const STATUS_COLORS = {
  "New": C.textLight, "Contacted": C.green, "Follow-up": C.gold,
  "Qualified": C.greenLight, "Closed": C.textMid, "Not interested": C.red,
};

// ─── RESPONSIVE HOOK ─────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
};

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    home:      "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    task:      "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
    users:     "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M9 7a4 4 0 100 8 4 4 0 000-8z",
    plus:      "M12 5v14 M5 12h14",
    x:         "M18 6L6 18 M6 6l12 12",
    mic:       "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8",
    check:     "M20 6L9 17l-5-5",
    trash:     "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
    send:      "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
    briefcase: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2",
    flag:      "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",
    comment:   "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
    logout:    "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
    eye:       "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
    eyeoff:    "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94 M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19 M1 1l22 22",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {(icons[name] || "").split(" M").map((d, i) => (
        <path key={i} d={(i === 0 ? "" : "M") + d} />
      ))}
    </svg>
  );
};

// ─── SHARED UI ───────────────────────────────────────────────────────────────
const Badge = ({ color, label }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}44`,
    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
    letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap",
  }}>{label}</span>
);

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: `1.5px solid ${C.border}`, background: C.white,
  fontSize: 15, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const selectStyle = { ...inputStyle, cursor: "pointer" };
const btnPrimary = {
  background: C.green, color: C.cream, border: "none", borderRadius: 10,
  padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer",
  width: "100%", marginTop: 8, letterSpacing: "0.02em", fontFamily: "inherit",
};
const btnSecondary = { ...btnPrimary, background: "none", color: C.green, border: `1.5px solid ${C.green}`, marginTop: 6 };

// ─── MODAL ───────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  const mob = window.innerWidth < 768;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center",
      padding: mob ? 0 : 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: mob ? "20px 20px 0 0" : 20,
        padding: "28px 24px 40px", width: "100%", maxWidth: wide ? 720 : 560,
        maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 700, color: C.green }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMid }}><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── COMMENTS THREAD ─────────────────────────────────────────────────────────
const CommentsThread = ({ itemId, itemType, user }) => {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    supabase.from("comments").select("*").eq("item_id", itemId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setComments(data || []));
  }, [itemId]);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const row = {
      item_id: String(itemId), item_type: itemType,
      user_id: user.id,
      user_email: user.email,
      display_name: user.user_metadata?.display_name || user.email.split("@")[0],
      body: text.trim(),
      created_at: new Date().toISOString(),
    };
    const { data } = await supabase.from("comments").insert(row);
    const saved = Array.isArray(data) ? data[0] : row;
    setComments(prev => [...prev, saved]);
    setText(""); setLoading(false);
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Comments {comments.length > 0 && `(${comments.length})`}
      </div>
      {comments.length === 0 && (
        <div style={{ fontSize: 13, color: C.textLight, marginBottom: 14 }}>No comments yet.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {comments.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", background: C.green + "20",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.green, fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>{(c.display_name || "?")[0].toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.display_name}</span>
                <span style={{ fontSize: 11, color: C.textLight }}>
                  {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div style={{ fontSize: 14, color: C.textMid, background: C.white, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.border}` }}>{c.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1, fontSize: 13 }}
          placeholder="Add a comment..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
        />
        <button onClick={submit} disabled={loading} style={{
          background: C.green, border: "none", borderRadius: 10,
          padding: "0 16px", cursor: "pointer", opacity: loading ? 0.6 : 1, flexShrink: 0,
        }}>
          <Icon name="send" size={15} color={C.cream} />
        </button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════════════════════════
const Login = ({ onAuth }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error); setLoading(false); return; }
      onAuth(data.user || data);
    } else {
      if (!name.trim()) { setError("Please enter a display name."); setLoading(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
      if (error) { setError(error); setLoading(false); return; }
      onAuth(data.user || data);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100dvh", background: C.cream, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 52, fontWeight: 700, color: C.green }}>teki</span>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.gold, display: "inline-block", marginBottom: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: C.textLight, marginTop: 2, letterSpacing: "0.1em", textTransform: "uppercase" }}>Command Center</div>
        </div>

        <div style={{ background: C.white, borderRadius: 20, padding: "32px 28px", border: `1px solid ${C.border}`, boxShadow: "0 4px 32px rgba(0,0,0,0.07)" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 700, color: C.green, marginBottom: 24 }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </div>
          {mode === "signup" && (
            <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Display name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          )}
          <input style={{ ...inputStyle, marginBottom: 12 }} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoFocus={mode === "login"} />
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input style={{ ...inputStyle, paddingRight: 46 }} type={showPw ? "text" : "password"} placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
            <button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textLight }}>
              <Icon name={showPw ? "eyeoff" : "eye"} size={16} />
            </button>
          </div>
          {error && <div style={{ fontSize: 13, color: C.red, background: C.red + "10", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>{String(error)}</div>}
          <button style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textMid }}>
            {mode === "login" ? "No account? " : "Have an account? "}
            <button onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(""); }} style={{ background: "none", border: "none", color: C.green, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.textLight }}>Data is private to your account</div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
const Dashboard = ({ tasks, contacts, user }) => {
  const pending = tasks.filter(t => !t.done);
  const hotContacts = contacts.filter(c => c.status === "Follow-up");
  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "there";
  const hour = new Date().getHours();

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenMid} 100%)`, borderRadius: 20, padding: "28px 28px 24px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: C.gold + "18" }} />
        <div style={{ position: "absolute", bottom: -20, right: 60, width: 80, height: 80, borderRadius: "50%", background: C.gold + "0f" }} />
        <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, color: C.cream, fontWeight: 700, lineHeight: 1.2 }}>
          {hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, {displayName}
        </div>
        <div style={{ fontSize: 13, color: C.cream + "aa", marginTop: 8 }}>
          {pending.length} open task{pending.length !== 1 ? "s" : ""} · {hotContacts.length} follow-up{hotContacts.length !== 1 ? "s" : ""} needed
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Open Tasks", value: pending.length, icon: "task", color: C.green },
          { label: "Follow-ups", value: hotContacts.length, icon: "flag", color: C.gold },
          { label: "Pipeline", value: contacts.length, icon: "users", color: C.red },
        ].map(s => (
          <div key={s.label} style={{ background: C.white, borderRadius: 16, padding: "18px 14px", border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ marginBottom: 6 }}><Icon name={s.icon} size={20} color={s.color} /></div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.textLight, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {pending.slice(0, 5).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Open Tasks</div>
          {pending.slice(0, 5).map(t => {
            const proj = PROJECTS.find(p => p.id === t.project);
            return (
              <div key={t.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: proj?.color || C.green, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 500 }}>{t.title}</div>
                {proj && <Badge color={proj.color} label={proj.name.split(" ")[0]} />}
              </div>
            );
          })}
        </div>
      )}

      {hotContacts.slice(0, 3).length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Needs Follow-up</div>
          {hotContacts.slice(0, 3).map(c => {
            const proj = PROJECTS.find(p => p.id === c.project);
            return (
              <div key={c.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: C.gold + "20", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{c.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: C.textLight }}>{c.company}</div>
                </div>
                {proj && <Badge color={proj.color} label={proj.name.split(" ")[0]} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// NOTES THREAD — reusable timestamped notes log
// ═════════════════════════════════════════════════════════════════════════════
const NotesThread = ({ notes = [], onAdd }) => {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), date: new Date().toISOString() });
    setText("");
  };
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Notes {notes.length > 0 && `(${notes.length})`}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <textarea
          style={{ ...inputStyle, flex: 1, minHeight: 64, resize: "vertical", fontSize: 13 }}
          placeholder="Add a note..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button onClick={submit} style={{ background: C.green, border: "none", borderRadius: 10, padding: "0 14px", cursor: "pointer", flexShrink: 0, alignSelf: "flex-end", height: 42 }}>
          <Icon name="plus" size={16} color={C.cream} />
        </button>
      </div>
      {notes.length === 0 && <div style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>No notes yet.</div>}
      {notes.map((n, i) => (
        <div key={i} style={{ borderLeft: `3px solid ${C.greenLight}`, paddingLeft: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 2 }}>
            {new Date(n.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
          <div style={{ fontSize: 13, color: C.text, whiteSpace: "pre-wrap" }}>{n.text}</div>
        </div>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// TASKS
// ═════════════════════════════════════════════════════════════════════════════
const Tasks = ({ tasks, setTasks, user }) => {
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ title: "", project: "other", priority: "normal", notes: "" });
  const [filter, setFilter] = useState("all");
  const [listening, setListening] = useState(false);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported in this browser."); return; }
    const r = new SR(); r.lang = "en-US"; r.interimResults = false;
    r.onresult = e => setForm(f => ({ ...f, title: e.results[0][0].transcript }));
    r.onend = () => setListening(false);
    r.start(); setListening(true);
  };

  const addTask = async () => {
    if (!form.title.trim()) return;
    const row = { ...form, task_notes: [], done: false, user_id: user.id, created_at: new Date().toISOString() };
    const { data } = await supabase.from("tasks").insert(row);
    if (!Array.isArray(data) || !data[0]) {
      alert("Error saving task — please check your Supabase connection.");
      return;
    }
    setTasks(prev => [data[0], ...prev]);
    setModal(false); setForm({ title: "", project: "other", priority: "normal", notes: "" });
  };

  const toggleDone = async (t) => {
    // Update UI instantly
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: !t.done } : x));
    // Then sync to Supabase in background
    await supabase.from("tasks").update({ done: !t.done }).eq("id", t.id);
  };

  const deleteTask = async (id) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(x => x.id !== id));
    setDetail(null);
  };

  const addTaskNote = async (note) => {
    if (!detail) return;
    const updated = [note, ...(detail.task_notes || [])];
    const { data } = await supabase.from("tasks").update({ task_notes: updated }).eq("id", detail.id);
    if (data === null || (Array.isArray(data) && data.length === 0)) {
      // Still update local state so UI feels responsive
    }
    setTasks(prev => prev.map(x => x.id === detail.id ? { ...x, task_notes: updated } : x));
    setDetail(prev => ({ ...prev, task_notes: updated }));
  };

  const filtered = filter === "all" ? tasks.filter(t => !t.done)
    : filter === "done" ? tasks.filter(t => t.done)
    : tasks.filter(t => t.project === filter && !t.done);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 700, color: C.green }}>Tasks</span>
        <button onClick={() => setModal(true)} style={{ background: C.green, color: C.cream, border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="plus" size={16} color={C.cream} /> Add
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {[{ id: "all", label: "All Open" }, { id: "done", label: "Done" }, ...PROJECTS.map(p => ({ id: p.id, label: p.name.split(" ")[0] }))].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            background: filter === f.id ? C.green : C.white, color: filter === f.id ? C.cream : C.textMid,
            border: `1.5px solid ${filter === f.id ? C.green : C.border}`,
            borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: "center", color: C.textLight, padding: "40px 0", fontSize: 14 }}>No tasks here</div>}

      {filtered.map(t => {
        const proj = PROJECTS.find(p => p.id === t.project);
        const noteCount = (t.task_notes || []).length;
        return (
          <div key={t.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, opacity: t.done ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <button onClick={() => toggleDone(t)} style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                border: `2px solid ${proj?.color || C.green}`,
                background: t.done ? (proj?.color || C.green) : "transparent",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
              }}>
                {t.done && <Icon name="check" size={12} color={C.white} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.text, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                {t.notes && <div style={{ fontSize: 12, color: C.textLight, marginTop: 3 }}>{t.notes}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {proj && <Badge color={proj.color} label={proj.name.split(" ")[0]} />}
                  {t.priority === "high" && <Badge color={C.red} label="High" />}
                  {noteCount > 0 && <span style={{ fontSize: 11, color: C.textLight }}>📝 {noteCount} note{noteCount !== 1 ? "s" : ""}</span>}
                </div>
              </div>
              <button onClick={() => setDetail(t)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, flexShrink: 0, padding: 4 }}>
                <Icon name="comment" size={16} />
              </button>
              <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, flexShrink: 0, padding: 4 }}>
                <Icon name="trash" size={15} />
              </button>
            </div>
          </div>
        );
      })}

      <Modal open={modal} onClose={() => setModal(false)} title="New Task">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="What needs to be done?" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === "Enter" && addTask()} autoFocus />
          <button onClick={startVoice} style={{ background: listening ? C.red + "18" : C.creamDark, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "0 14px", cursor: "pointer", flexShrink: 0 }}>
            <Icon name="mic" size={18} color={listening ? C.red : C.textMid} />
          </button>
        </div>
        <select style={{ ...selectStyle, marginBottom: 12 }} value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
          {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select style={{ ...selectStyle, marginBottom: 12 }} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          <option value="normal">Normal priority</option>
          <option value="high">High priority</option>
        </select>
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical", marginBottom: 8 }} placeholder="Initial notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        <button style={btnPrimary} onClick={addTask}>Add Task</button>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title || ""} wide>
        {detail && (
          <>
            <div style={{ marginBottom: 20 }}>
              {(() => { const proj = PROJECTS.find(p => p.id === detail.project); return proj ? <Badge color={proj.color} label={proj.name} /> : null; })()}
              {detail.priority === "high" && <span style={{ marginLeft: 6 }}><Badge color={C.red} label="High Priority" /></span>}
              {detail.notes && <div style={{ fontSize: 13, color: C.textMid, marginTop: 10, background: C.creamDark, borderRadius: 10, padding: "10px 14px" }}>{detail.notes}</div>}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 20 }}>
              <NotesThread notes={detail.task_notes || []} onAdd={addTaskNote} />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <CommentsThread itemId={String(detail.id)} itemType="task" user={user} />
            </div>
            <button onClick={() => deleteTask(detail.id)} style={{ ...btnSecondary, color: C.red, borderColor: C.red, marginTop: 20 }}>Delete Task</button>
          </>
        )}
      </Modal>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// CRM / PIPELINE
// ═════════════════════════════════════════════════════════════════════════════
const BLANK_PERSON = { name: "", role: "", email: "", phone: "", whatsapp: "", telegram: "" };

const CRM = ({ contacts, setContacts, user }) => {
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ name: "", company: "", project: "other", status: "New", notes: "", people: [] });
  const [filter, setFilter] = useState("all");
  const [outreachNote, setOutreachNote] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [personForm, setPersonForm] = useState(BLANK_PERSON);

  const addContact = async () => {
    if (!form.name.trim()) return;
    const row = { ...form, outreach: [], contact_notes: [], people: [], user_id: user.id, created_at: new Date().toISOString() };
    const { data } = await supabase.from("contacts").insert(row);
    if (!Array.isArray(data) || !data[0]) {
      alert("Error saving contact — please check your Supabase connection.");
      return;
    }
    setContacts(prev => [data[0], ...prev]);
    setModal(false);
    setForm({ name: "", company: "", project: "other", status: "New", notes: "", people: [] });
  };

  const updateStatus = async (id, status) => {
    await supabase.from("contacts").update({ status }).eq("id", id);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    setDetail(prev => prev ? { ...prev, status } : prev);
  };

  const addOutreach = async () => {
    if (!outreachNote.trim() || !detail) return;
    const entry = { date: new Date().toISOString(), note: outreachNote };
    const updated = [entry, ...(detail.outreach || [])];
    await supabase.from("contacts").update({ outreach: updated }).eq("id", detail.id);
    setContacts(prev => prev.map(c => c.id === detail.id ? { ...c, outreach: updated } : c));
    setDetail(prev => ({ ...prev, outreach: updated }));
    setOutreachNote("");
  };

  const addContactNote = async (note) => {
    if (!detail) return;
    const updated = [note, ...(detail.contact_notes || [])];
    await supabase.from("contacts").update({ contact_notes: updated }).eq("id", detail.id);
    setContacts(prev => prev.map(c => c.id === detail.id ? { ...c, contact_notes: updated } : c));
    setDetail(prev => ({ ...prev, contact_notes: updated }));
  };

  const addPerson = async () => {
    if (!personForm.name.trim() || !detail) return;
    const updated = [...(detail.people || []), { ...personForm, id: Date.now() }];
    await supabase.from("contacts").update({ people: updated }).eq("id", detail.id);
    setContacts(prev => prev.map(c => c.id === detail.id ? { ...c, people: updated } : c));
    setDetail(prev => ({ ...prev, people: updated }));
    setPersonForm(BLANK_PERSON);
    setAddingPerson(false);
  };

  const removePerson = async (personId) => {
    if (!detail) return;
    const updated = (detail.people || []).filter(p => p.id !== personId);
    await supabase.from("contacts").update({ people: updated }).eq("id", detail.id);
    setContacts(prev => prev.map(c => c.id === detail.id ? { ...c, people: updated } : c));
    setDetail(prev => ({ ...prev, people: updated }));
  };

  const deleteContact = async (id) => {
    await supabase.from("contacts").delete().eq("id", id);
    setContacts(prev => prev.filter(c => c.id !== id));
    setDetail(null);
  };

  const filtered = filter === "all" ? contacts : contacts.filter(c => c.status === filter);

  const ContactLink = ({ icon, value, href }) => {
    if (!value) return null;
    return (
      <a href={href || "#"} target="_blank" rel="noreferrer" style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, color: C.green, fontWeight: 600, textDecoration: "none",
        background: C.green + "12", padding: "4px 10px", borderRadius: 6,
      }}>
        <span>{icon}</span>{value}
      </a>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 700, color: C.green }}>Pipeline</span>
        <button onClick={() => setModal(true)} style={{ background: C.green, color: C.cream, border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="plus" size={16} color={C.cream} /> Add
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {["all", ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            background: filter === s ? C.green : C.white, color: filter === s ? C.cream : C.textMid,
            border: `1.5px solid ${filter === s ? C.green : C.border}`,
            borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}>{s === "all" ? "All" : s}</button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: "center", color: C.textLight, padding: "40px 0", fontSize: 14 }}>No contacts yet</div>}

      {filtered.map(c => {
        const proj = PROJECTS.find(p => p.id === c.project);
        const peopleCount = (c.people || []).length;
        return (
          <div key={c.id} onClick={() => { setDetail(c); setOutreachNote(""); setAddingPerson(false); setPersonForm(BLANK_PERSON); }}
            style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: (proj?.color || C.green) + "20", display: "flex", alignItems: "center", justifyContent: "center", color: proj?.color || C.green, fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{c.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 12, color: C.textLight }}>{c.company}{peopleCount > 0 ? ` · ${peopleCount} contact${peopleCount !== 1 ? "s" : ""}` : ""}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <Badge color={STATUS_COLORS[c.status] || C.textLight} label={c.status} />
                {proj && <span style={{ fontSize: 10, color: C.textLight }}>{proj.name.split(" ")[0]}</span>}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add contact modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="New Contact">
        <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Company / Organization *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Industry / description" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
        <select style={{ ...selectStyle, marginBottom: 10 }} value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
          {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select style={{ ...selectStyle, marginBottom: 10 }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical", marginBottom: 8 }} placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        <button style={btnPrimary} onClick={addContact}>Add to Pipeline</button>
      </Modal>

      {/* Contact detail modal */}
      <Modal open={!!detail} onClose={() => { setDetail(null); setOutreachNote(""); setAddingPerson(false); }} title={detail?.name || ""} wide>
        {detail && (() => {
          const proj = PROJECTS.find(p => p.id === detail.project);
          return (
            <>
              {/* Header info */}
              <div style={{ marginBottom: 16 }}>
                {detail.company && <div style={{ fontSize: 13, color: C.textMid, marginBottom: 6 }}>{detail.company}</div>}
                {proj && <Badge color={proj.color} label={proj.name} />}
              </div>

              {/* Status */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Status</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => updateStatus(detail.id, s)} style={{
                      background: detail.status === s ? (STATUS_COLORS[s] || C.green) : C.creamDark,
                      color: detail.status === s ? C.white : C.textMid,
                      border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>{s}</button>
                  ))}
                </div>
              </div>

              {/* People at this company */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Contacts at {detail.name}
                  </div>
                  <button onClick={() => setAddingPerson(p => !p)} style={{ background: C.green + "15", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: C.green, cursor: "pointer" }}>
                    + Add person
                  </button>
                </div>

                {addingPerson && (
                  <div style={{ background: C.creamDark, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <input style={{ ...inputStyle, fontSize: 13 }} placeholder="Full name *" value={personForm.name} onChange={e => setPersonForm(p => ({ ...p, name: e.target.value }))} autoFocus />
                      <input style={{ ...inputStyle, fontSize: 13 }} placeholder="Role / Title" value={personForm.role} onChange={e => setPersonForm(p => ({ ...p, role: e.target.value }))} />
                    </div>
                    <input style={{ ...inputStyle, fontSize: 13, marginBottom: 8 }} placeholder="Email" value={personForm.email} onChange={e => setPersonForm(p => ({ ...p, email: e.target.value }))} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <input style={{ ...inputStyle, fontSize: 13 }} placeholder="📞 Phone" value={personForm.phone} onChange={e => setPersonForm(p => ({ ...p, phone: e.target.value }))} />
                      <input style={{ ...inputStyle, fontSize: 13 }} placeholder="💬 WhatsApp" value={personForm.whatsapp} onChange={e => setPersonForm(p => ({ ...p, whatsapp: e.target.value }))} />
                      <input style={{ ...inputStyle, fontSize: 13 }} placeholder="✈️ Telegram" value={personForm.telegram} onChange={e => setPersonForm(p => ({ ...p, telegram: e.target.value }))} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...btnPrimary, marginTop: 0, flex: 1 }} onClick={addPerson}>Save person</button>
                      <button style={{ ...btnSecondary, marginTop: 0, flex: 0.4 }} onClick={() => { setAddingPerson(false); setPersonForm(BLANK_PERSON); }}>Cancel</button>
                    </div>
                  </div>
                )}

                {(detail.people || []).length === 0 && !addingPerson && (
                  <div style={{ fontSize: 12, color: C.textLight }}>No contacts added yet.</div>
                )}

                {(detail.people || []).map(p => (
                  <div key={p.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{p.name}</div>
                        {p.role && <div style={{ fontSize: 12, color: C.textLight, marginBottom: 6 }}>{p.role}</div>}
                        {p.email && (
                          <div style={{ marginBottom: 4 }}>
                            <a href={`mailto:${p.email}`} style={{ fontSize: 12, color: C.green, textDecoration: "none" }}>✉️ {p.email}</a>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          {p.phone && <ContactLink icon="📞" value={p.phone} href={`tel:${p.phone}`} />}
                          {p.whatsapp && <ContactLink icon="💬" value={p.whatsapp} href={`https://wa.me/${p.whatsapp.replace(/\D/g,"")}`} />}
                          {p.telegram && <ContactLink icon="✈️" value={p.telegram} href={`https://t.me/${p.telegram.replace("@","")}`} />}
                        </div>
                      </div>
                      <button onClick={() => removePerson(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 4, flexShrink: 0 }}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 20 }}>
                <NotesThread notes={detail.contact_notes || []} onAdd={addContactNote} />
              </div>

              {/* Outreach log */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Outreach Log</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input style={{ ...inputStyle, flex: 1, fontSize: 13 }} placeholder="Log a touch point..." value={outreachNote}
                    onChange={e => setOutreachNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addOutreach()} />
                  <button onClick={addOutreach} style={{ background: C.green, border: "none", borderRadius: 10, padding: "0 14px", cursor: "pointer", flexShrink: 0 }}>
                    <Icon name="send" size={15} color={C.cream} />
                  </button>
                </div>
                {(detail.outreach || []).map((o, i) => (
                  <div key={i} style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: C.textLight }}>{new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    <div style={{ fontSize: 13, color: C.text }}>{o.note}</div>
                  </div>
                ))}
                {(!detail.outreach || detail.outreach.length === 0) && <div style={{ fontSize: 12, color: C.textLight }}>No outreach logged yet</div>}
              </div>

              {/* Comments */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 16 }}>
                <CommentsThread itemId={String(detail.id)} itemType="contact" user={user} />
              </div>

              <button onClick={() => deleteContact(detail.id)} style={{ ...btnSecondary, color: C.red, borderColor: C.red }}>Delete Contact</button>
            </>
          );
        })()}
      </Modal>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PROJECTS VIEW
// ═════════════════════════════════════════════════════════════════════════════
const ProjectsView = ({ tasks, contacts }) => (
  <div>
    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 700, color: C.green, marginBottom: 16 }}>Projects</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {PROJECTS.filter(p => p.id !== "other").map(p => {
        const pTasks = tasks.filter(t => t.project === p.id && !t.done).length;
        const pContacts = contacts.filter(c => c.project === p.id).length;
        return (
          <div key={p.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: p.color }} />
            <div style={{ paddingLeft: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 12 }}>{p.name}</div>
              <div style={{ display: "flex", gap: 20 }}>
                {[{ label: "Open tasks", val: pTasks }, { label: "Contacts", val: pContacts }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: p.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN VIEW — sees all users' tasks + contacts
// ═════════════════════════════════════════════════════════════════════════════
const AdminView = ({ allTasks, allContacts, allUsers }) => {
  const [viewTab, setViewTab] = useState("tasks");
  const [userFilter, setUserFilter] = useState("all");

  const getName = (uid) => {
    const u = allUsers.find(x => x.user_id === uid);
    return u?.display_name || u?.email || uid?.slice(0, 8) + "…";
  };

  const userIds = [...new Set([...allTasks.map(t => t.user_id), ...allContacts.map(c => c.user_id)])];

  const filteredTasks = userFilter === "all" ? allTasks : allTasks.filter(t => t.user_id === userFilter);
  const filteredContacts = userFilter === "all" ? allContacts : allContacts.filter(c => c.user_id === userFilter);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: C.gold + "25", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="eye" size={18} color={C.gold} />
        </div>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 700, color: C.green }}>Admin View</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{userIds.length} team member{userIds.length !== 1 ? "s" : ""} · {allTasks.filter(t => !t.done).length} open tasks · {allContacts.length} pipeline contacts</div>
        </div>
      </div>

      {/* User filter */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Filter by member</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <button onClick={() => setUserFilter("all")} style={{
            background: userFilter === "all" ? C.green : C.white, color: userFilter === "all" ? C.cream : C.textMid,
            border: `1.5px solid ${userFilter === "all" ? C.green : C.border}`,
            borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}>All members</button>
          {userIds.map(uid => (
            <button key={uid} onClick={() => setUserFilter(uid)} style={{
              background: userFilter === uid ? C.green : C.white, color: userFilter === uid ? C.cream : C.textMid,
              border: `1.5px solid ${userFilter === uid ? C.green : C.border}`,
              borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>{getName(uid)}</button>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, background: C.creamDark, borderRadius: 12, padding: 4, marginBottom: 20 }}>
        {[{ id: "tasks", label: `Tasks (${filteredTasks.filter(t => !t.done).length} open)` }, { id: "contacts", label: `Pipeline (${filteredContacts.length})` }].map(t => (
          <button key={t.id} onClick={() => setViewTab(t.id)} style={{
            flex: 1, background: viewTab === t.id ? C.white : "transparent",
            color: viewTab === t.id ? C.green : C.textMid,
            border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            boxShadow: viewTab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tasks view */}
      {viewTab === "tasks" && (
        <div>
          {filteredTasks.length === 0 && <div style={{ textAlign: "center", color: C.textLight, padding: "40px 0" }}>No tasks</div>}
          {filteredTasks.map(t => {
            const proj = PROJECTS.find(p => p.id === t.project);
            return (
              <div key={t.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, opacity: t.done ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${proj?.color || C.green}`, background: t.done ? (proj?.color || C.green) : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                    {t.done && <Icon name="check" size={12} color={C.white} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: C.text, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                    {t.notes && <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>{t.notes}</div>}
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {proj && <Badge color={proj.color} label={proj.name.split(" ")[0]} />}
                      {t.priority === "high" && <Badge color={C.red} label="High" />}
                      <span style={{ fontSize: 11, color: C.textLight, background: C.creamDark, borderRadius: 4, padding: "2px 7px" }}>👤 {getName(t.user_id)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contacts view */}
      {viewTab === "contacts" && (
        <div>
          {filteredContacts.length === 0 && <div style={{ textAlign: "center", color: C.textLight, padding: "40px 0" }}>No contacts</div>}
          {filteredContacts.map(c => {
            const proj = PROJECTS.find(p => p.id === c.project);
            return (
              <div key={c.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: (proj?.color || C.green) + "20", display: "flex", alignItems: "center", justifyContent: "center", color: proj?.color || C.green, fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{c.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: C.textLight }}>{c.company}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge color={STATUS_COLORS[c.status] || C.textLight} label={c.status} />
                      {proj && <Badge color={proj.color} label={proj.name.split(" ")[0]} />}
                      <span style={{ fontSize: 11, color: C.textLight, background: C.creamDark, borderRadius: 4, padding: "2px 7px" }}>👤 {getName(c.user_id)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function Teki() {
  const [user, setUser] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    const { data } = supabase.auth.getSession();
    const session = data?.session;
    if (!session) { setAppLoading(false); return; }

    // Always extract the user object correctly
    const sessionUser = session.user || (session.access_token ? session : null);
    if (!sessionUser) { setAppLoading(false); return; }

    // Refresh the token if it's going to expire within 10 minutes
    const exp = session.expires_at || (session.access_token
      ? JSON.parse(atob(session.access_token.split(".")[1])).exp
      : 0);
    const expiresIn = exp - Math.floor(Date.now() / 1000);
    if (expiresIn < 600) {
      // Token nearly expired — refresh it
      fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }).then(r => r.json()).then(refreshed => {
        if (refreshed.access_token) {
          supabase.auth._saveSession ? supabase.auth._saveSession(refreshed) : null;
          try { localStorage.setItem("teki_session", JSON.stringify(refreshed)); } catch {}
          setUser(refreshed.user || refreshed);
        } else {
          // Refresh failed — force re-login
          localStorage.removeItem("teki_session");
          setAppLoading(false);
        }
      }).catch(() => setAppLoading(false));
    } else {
      setUser(sessionUser);
    }
    setAppLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.id || user.user?.id || user.sub;
    if (!uid) return;
    // Own data
    supabase.from("tasks").select("*").eq("user_id", uid).order("created_at", { ascending: false }).then(({ data }) => setTasks(data || []));
    supabase.from("contacts").select("*").eq("user_id", uid).order("created_at", { ascending: false }).then(({ data }) => setContacts(data || []));
    // Admin check
    supabase.from("admins").select("*").eq("user_id", uid).then(({ data }) => {
      if (data && data.length > 0) {
        setIsAdmin(true);
        supabase.from("tasks").select("*").order("created_at", { ascending: false }).then(({ data: d }) => setAllTasks(d || []));
        supabase.from("contacts").select("*").order("created_at", { ascending: false }).then(({ data: d }) => setAllContacts(d || []));
        supabase.from("user_profiles").select("*").order("created_at", { ascending: true }).then(({ data: d }) => setAllUsers(d || []));
      }
    });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setTasks([]); setContacts([]);
  };

  const tabs = [
    { id: "home",     label: "Home",     icon: "home" },
    { id: "tasks",    label: "Tasks",    icon: "task" },
    { id: "pipeline", label: "Pipeline", icon: "users" },
    { id: "projects", label: "Projects", icon: "briefcase" },
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: "eye" }] : []),
  ];

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; font-family: 'DM Sans', sans-serif; }
  `;

  if (appLoading) return (
    <>
      <style>{globalStyles}</style>
      <div style={{ minHeight: "100dvh", background: C.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, color: C.green, fontWeight: 700 }}>teki<span style={{ color: C.gold }}>.</span></div>
      </div>
    </>
  );

  if (!user) return <><style>{globalStyles}</style><Login onAuth={setUser} /></>;

  const normalizedUser = (() => {
    if (!user) return null;
    if (user.id && user.email) return user; // already a user object
    if (user.user?.id) return user.user;     // nested under .user
    return user;
  })();

  const content = (
    <>
      {tab === "home"     && <Dashboard tasks={tasks} contacts={contacts} user={normalizedUser} />}
      {tab === "tasks"    && <Tasks tasks={tasks} setTasks={setTasks} user={normalizedUser} />}
      {tab === "pipeline" && <CRM contacts={contacts} setContacts={setContacts} user={normalizedUser} />}
      {tab === "projects" && <ProjectsView tasks={tasks} contacts={contacts} />}
      {tab === "admin"    && isAdmin && <AdminView allTasks={allTasks} allContacts={allContacts} allUsers={allUsers} />}
    </>
  );

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  if (!isMobile) return (
    <>
      <style>{`${globalStyles} body { background: ${C.creamDark}; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }`}</style>
      <div style={{ display: "flex", minHeight: "100dvh" }}>
        <div style={{ width: 240, background: C.green, display: "flex", flexDirection: "column", padding: "32px 0", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}>
          <div style={{ padding: "0 24px 28px", borderBottom: `1px solid ${C.greenMid}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 30, fontWeight: 700, color: C.cream }}>teki</span>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.gold, display: "inline-block" }} />
            </div>
            <div style={{ fontSize: 10, color: C.cream + "55", marginTop: 2, letterSpacing: "0.1em", textTransform: "uppercase" }}>Command Center</div>
          </div>
          <nav style={{ flex: 1, padding: "20px 12px" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                borderRadius: 12, border: "none", cursor: "pointer",
                background: tab === t.id ? "rgba(255,255,255,0.12)" : "transparent",
                color: tab === t.id ? C.cream : C.cream + "77",
                fontFamily: "inherit", fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
                marginBottom: 4, transition: "all 0.15s",
              }}>
                <Icon name={t.icon} size={17} color={tab === t.id ? C.gold : C.cream + "66"} />
                {t.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: "16px 12px", borderTop: `1px solid ${C.greenMid}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.gold + "30", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {(normalizedUser?.user_metadata?.display_name || normalizedUser?.email || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.cream, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {normalizedUser?.user_metadata?.display_name || normalizedUser?.email?.split("@")[0]}
                </div>
                <div style={{ fontSize: 11, color: C.cream + "44", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{normalizedUser?.email}</div>
              </div>
            </div>
            <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "none", border: "none", borderRadius: 10, cursor: "pointer", color: C.cream + "66", fontFamily: "inherit", fontSize: 13 }}>
              <Icon name="logout" size={15} color={C.cream + "66"} /> Sign out
            </button>
          </div>
        </div>
        <div style={{ marginLeft: 240, flex: 1, padding: "40px 48px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>{content}</div>
        </div>
      </div>
    </>
  );

  // ── MOBILE ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`${globalStyles} body { background: ${C.creamDark}; } ::-webkit-scrollbar { display: none; }`}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", background: C.cream, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cream, position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 700, color: C.green }}>teki</span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.gold, display: "inline-block", marginBottom: 2 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 11, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
            <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 0 }}>
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, padding: "20px 20px 100px", overflowY: "auto" }}>{content}</div>
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 4px 20px", zIndex: 200 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: tab === t.id ? C.green : C.textLight }}>
              <div style={{ width: 36, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: tab === t.id ? C.green + "15" : "transparent" }}>
                <Icon name={t.icon} size={18} color={tab === t.id ? C.green : C.textLight} />
              </div>
              <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
