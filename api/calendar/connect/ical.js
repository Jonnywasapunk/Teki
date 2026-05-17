// api/calendar/connect/ical.js
// Saves an iCal feed URL as a calendar connection

import { getUserFromToken, db } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { ical_url, account_email, account_label } = req.body || {};

  if (!ical_url || typeof ical_url !== "string") {
    return res.status(400).json({ error: "ical_url is required" });
  }
  if (!account_email || typeof account_email !== "string") {
    return res.status(400).json({ error: "account_email is required" });
  }

  let parsed;
  try {
    parsed = new URL(ical_url.replace(/^webcal:/i, "https:"));
  } catch {
    return res.status(400).json({ error: "Invalid iCal URL format" });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "iCal URL must use http or https" });
  }

  try {
    const probe = await fetch(parsed.toString(), {
      method: "GET",
      headers: { "User-Agent": "Teki-Calendar/1.0" },
      redirect: "follow",
    });
    if (!probe.ok) {
      return res.status(400).json({
        error: "Could not fetch iCal feed",
        details: "Server returned HTTP " + probe.status,
      });
    }
    const sample = await probe.text();
    if (!sample.includes("BEGIN:VCALENDAR")) {
      return res.status(400).json({
        error: "URL does not return iCal data",
        details: "Response did not contain BEGIN:VCALENDAR",
      });
    }
  } catch (e) {
    return res.status(400).json({
      error: "Failed to reach iCal URL",
      details: e.message || "network error",
    });
  }

  const row = {
    user_id: user.id,
    provider: "ical",
    account_email: account_email,
    account_label: account_label || account_email,
    ical_url: parsed.toString(),
    is_active: true,
    last_synced_at: new Date().toISOString(),
    last_error: null,
  };

  const { data: connection, error: connError } = await db.upsert(
    "calendar_connections",
    row,
    "user_id,provider,account_email"
  );

  if (connError || !connection) {
    return res.status(500).json({
      error: "Failed to save connection",
      details: connError,
    });
  }

  const sourceRow = {
    connection_id: connection.id,
    user_id: user.id,
    external_id: parsed.toString(),
    display_name: account_label || account_email,
    color: "#888888",
    is_enabled: true,
    visibility_level: "busy_only",
  };

  await db.upsert("calendar_sources", sourceRow, "connection_id,external_id");

  return res.status(200).json({
    ok: true,
    connection_id: connection.id,
    account_email: account_email,
  });
}
