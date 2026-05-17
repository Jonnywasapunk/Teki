// api/calendar/lib/supabase.js
// Supabase client for serverless functions, using service_role key

const SUPABASE_URL = process.env.SUPABASE_URL || "https://sozhjtedrwlvusmlxxer.supabase.co";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function check() {
  if (!SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY env var is not set");
  }
}

function headers() {
  check();
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_SERVICE_ROLE,
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
  };
}

export async function getUserFromToken(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE,
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

export const db = {
  insert: async (table, row) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) return { data: null, error: data || text || `HTTP ${r.status}` };
    return { data: Array.isArray(data) ? data[0] : data, error: null };
  },

  upsert: async (table, row, onConflict) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(row),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) return { data: null, error: data || text || `HTTP ${r.status}` };
    return { data: Array.isArray(data) ? data[0] : data, error: null };
  },

  select: async (table, query = "") => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: headers(),
    });
    const data = await r.json();
    if (!r.ok) return { data: null, error: data };
    return { data, error: null };
  },

  update: async (table, query, values) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify(values),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) return { data: null, error: data || text };
    return { data, error: null };
  },
};
