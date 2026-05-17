// api/calendar/availability.js
// Main availability endpoint — aggregates free/busy across all sources
// Query params:
//   start=ISO datetime (default: now - 1 day)
//   end=ISO datetime (default: now + 7 days)
//   user_ids=comma-separated user IDs (optional, default: all users with connections)
//
// Permission model: any authenticated Teki user can see everyone's busy windows.

import { getUserFromToken, db } from "./lib/supabase.js";
import { fetchFreeBusy, fetchEvents } from "./lib/google.js";
import { fetchIcalBusy } from "./lib/ical.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requester = await getUserFromToken(req.headers.authorization);
  if (!requester) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Parse query params
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString();
  const defaultEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
  const startISO = req.query.start || defaultStart;
  const endISO = req.query.end || defaultEnd;

  // Determine which users to include
  // Default: all users who have at least one active calendar connection
  let userIds;
  if (req.query.user_ids) {
    userIds = req.query.user_ids.split(",").filter(Boolean);
  } else {
    const { data: allConnections } = await db.select("calendar_connections", "select=user_id&is_active=eq.true");
    userIds = [...new Set((allConnections || []).map(c => c.user_id))];
  }

  if (userIds.length === 0) {
    return res.status(200).json({ start: startISO, end: endISO, users: [] });
  }

  // Fetch all connections for these users
  const userIdsCsv = userIds.map(id => `"${id}"`).join(",");
  const { data: connections } = await db.select(
    "calendar_connections",
    `user_id=in.(${userIdsCsv})&is_active=eq.true`
  );

  if (!connections || connections.length === 0) {
    return res.status(200).json({
      start: startISO,
      end: endISO,
      users: userIds.map(id => ({ user_id: id, busy: [] })),
    });
  }

  // Fetch all enabled sources for these connections
  const connIds = connections.map(c => `"${c.id}"`).join(",");
  const { data: sources } = await db.select(
    "calendar_sources",
    `connection_id=in.(${connIds})&is_enabled=eq.true`
  );

  // Index sources by connection
  const sourcesByConn = {};
  for (const s of (sources || [])) {
    if (!sourcesByConn[s.connection_id]) sourcesByConn[s.connection_id] = [];
    sourcesByConn[s.connection_id].push(s);
  }

  // Result accumulator: user_id -> array of busy windows
  const userBusy = {};
  for (const uid of userIds) userBusy[uid] = [];

  // Fetch in parallel per connection
  const tasks = connections.map(async (conn) => {
    const connSources = sourcesByConn[conn.id] || [];
    if (connSources.length === 0) return;

    try {
      if (conn.provider === "google") {
        const busyOnlyCalIds = connSources.filter(s => s.visibility_level === "busy_only").map(s => s.external_id);
        const fullDetailCalIds = connSources.filter(s => s.visibility_level === "full_details").map(s => s.external_id);

        const results = [];

        if (busyOnlyCalIds.length > 0) {
          const fb = await fetchFreeBusy(conn, busyOnlyCalIds, startISO, endISO);
          results.push(...fb);
        }

        for (const calId of fullDetailCalIds) {
          const evs = await fetchEvents(conn, calId, startISO, endISO);
          results.push(...evs);
        }

        for (const r of results) {
          userBusy[conn.user_id].push({
            ...r,
            provider: "google",
            account_email: conn.account_email,
          });
        }
      } else if (conn.provider === "ical") {
        for (const src of connSources) {
          const events = await fetchIcalBusy(conn, src, startISO, endISO);
          for (const e of events) {
            userBusy[conn.user_id].push({
              ...e,
              provider: "ical",
              account_email: conn.account_email,
            });
          }
        }
      }
      // microsoft: stubbed for now
    } catch (e) {
      console.error(`Failed to fetch for connection ${conn.id} (${conn.provider}):`, e.message);
    }
  });

  await Promise.all(tasks);

  for (const uid of Object.keys(userBusy)) {
    userBusy[uid].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  return res.status(200).json({
    start: startISO,
    end: endISO,
    users: userIds.map(id => ({
      user_id: id,
      busy: userBusy[id] || [],
    })),
  });
}
