// api/calendar/connections/delete.js
// HARD GATE: Only jonathan.rivas@dcdbgroup.com can disconnect any calendar.
// Anyone else gets 403 Forbidden.

import { getUserFromToken } from "../lib/supabase.js";

const AUTHORIZED_EMAIL = "jonathan.rivas@dcdbgroup.com";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (user.email !== AUTHORIZED_EMAIL) {
    return res.status(403).json({ error: "Only the account owner can disconnect calendars" });
  }

  const connectionId = req.query.id || (req.body && req.body.id);
  if (!connectionId) {
    return res.status(400).json({ error: "Missing connection id" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "https://sozhjtedrwlvusmlxxer.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const r = await fetch(
    `${supabaseUrl}/rest/v1/calendar_connections?id=eq.${connectionId}`,
    {
      method: "DELETE",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
    }
  );

  if (!r.ok) {
    const text = await r.text();
    return res.status(500).json({ error: "Failed to delete", details: text });
  }

  return res.status(200).json({ ok: true, deleted_id: connectionId });
}
