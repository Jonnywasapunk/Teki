// api/calendar/lib/microsoft.js
// Microsoft Graph API client — handles auth refresh + free/busy queries

import { encrypt, decrypt } from "./crypto.js";
import { db } from "./supabase.js";

const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Refresh an expired access token using the stored refresh_token
async function refreshAccessToken(connection) {
  const refreshToken = decrypt(connection.refresh_token);
  if (!refreshToken) throw new Error("No refresh token stored");

  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access Calendars.Read User.Read",
  });

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await r.json();
  if (!r.ok || !data.access_token) {
    throw new Error("Microsoft refresh failed: " + (data.error_description || data.error || "unknown"));
  }

  const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  await db.update("calendar_connections", "id=eq." + connection.id, {
    access_token: encrypt(data.access_token),
    refresh_token: data.refresh_token ? encrypt(data.refresh_token) : connection.refresh_token,
    token_expires_at: newExpiry,
    last_synced_at: new Date().toISOString(),
    last_error: null,
  });

  return data.access_token;
}

// Get a valid access token, refreshing if needed
async function getValidToken(connection) {
  const expiryMs = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (Date.now() + 60000 < expiryMs) {
    return decrypt(connection.access_token);
  }
  try {
    return await refreshAccessToken(connection);
  } catch (e) {
    await db.update("calendar_connections", "id=eq." + connection.id, {
      last_error: e.message || "refresh failed",
    });
    throw e;
  }
}

// Fetch user's calendars
export async function fetchCalendarList(connection) {
  const token = await getValidToken(connection);
  const r = await fetch(`${GRAPH_BASE}/me/calendars`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error("calendarList failed: " + text);
  }
  const data = await r.json();
  return data.value || [];
}

// Get the authenticated user's profile (for email)
export async function fetchUserProfile(connection) {
  const token = await getValidToken(connection);
  const r = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("profile failed");
  return await r.json();
}

// Fetch free/busy windows using getSchedule
export async function fetchFreeBusy(connection, calendarIds, startISO, endISO) {
  const token = await getValidToken(connection);

  // Microsoft's getSchedule needs SMTP addresses (calendar owners), not calendar IDs directly
  // For "me" calendars, the calendar owner is the user themselves
  // So we use the user's email for the schedules array
  const profile = await fetchUserProfile(connection);
  const userEmail = profile.mail || profile.userPrincipalName || connection.account_email;

  const body = {
    schedules: [userEmail],
    startTime: { dateTime: startISO, timeZone: "UTC" },
    endTime: { dateTime: endISO, timeZone: "UTC" },
    availabilityViewInterval: 30,
  };

  const r = await fetch(`${GRAPH_BASE}/me/calendar/getSchedule`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    console.error("getSchedule error:", text);
    return [];
  }

  const data = await r.json();
  const schedules = data.value || [];
  const busy = [];

  for (const sched of schedules) {
    const items = sched.scheduleItems || [];
    for (const item of items) {
      // status: free | tentative | busy | oof | workingElsewhere | unknown
      if (item.status === "free") continue;
      busy.push({
        source_external_id: calendarIds[0] || "primary",
        starts_at: new Date(item.start.dateTime + "Z").toISOString(),
        ends_at: new Date(item.end.dateTime + "Z").toISOString(),
        title: null,
      });
    }
  }

  return busy;
}

// Fetch detailed events from a specific calendar (for full_details visibility)
export async function fetchEvents(connection, calendarId, startISO, endISO) {
  const token = await getValidToken(connection);

  const url = new URL(`${GRAPH_BASE}/me/calendars/${calendarId}/calendarView`);
  url.searchParams.set("startDateTime", startISO);
  url.searchParams.set("endDateTime", endISO);
  url.searchParams.set("$top", "250");
  url.searchParams.set("$select", "subject,start,end,isAllDay,showAs");

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) {
    const text = await r.text();
    console.error("calendarView error:", text);
    return [];
  }

  const data = await r.json();
  const events = [];

  for (const ev of (data.value || [])) {
    if (!ev.start || !ev.end) continue;
    if (ev.showAs === "free") continue;
    events.push({
      source_external_id: calendarId,
      starts_at: new Date(ev.start.dateTime + "Z").toISOString(),
      ends_at: new Date(ev.end.dateTime + "Z").toISOString(),
      title: ev.subject || "Busy",
      is_all_day: !!ev.isAllDay,
    });
  }

  return events;
}
