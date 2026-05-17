// api/calendar/lib/google.js
// Google Calendar API client

import { google } from "googleapis";
import { encrypt, decrypt } from "./crypto.js";
import { db } from "./supabase.js";

async function getAuthClient(connection) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "https://teki.dcdbgroup.com/api/calendar/callback/google"
  );

  const accessToken = decrypt(connection.access_token);
  const refreshToken = connection.refresh_token ? decrypt(connection.refresh_token) : null;
  const expiryDate = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
  });

  if (Date.now() + 60000 >= expiryDate && refreshToken) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      const newExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString();

      await db.update(
        "calendar_connections",
        "id=eq." + connection.id,
        {
          access_token: encrypt(credentials.access_token),
          token_expires_at: newExpiry,
          last_synced_at: new Date().toISOString(),
          last_error: null,
        }
      );
    } catch (e) {
      await db.update("calendar_connections", "id=eq." + connection.id, {
        last_error: "Token refresh failed: " + (e.message || "unknown"),
      });
      throw e;
    }
  }

  return oauth2Client;
}

export async function fetchFreeBusy(connection, calendarIds, startISO, endISO) {
  const auth = await getAuthClient(connection);
  const calendar = google.calendar({ version: "v3", auth });

  const chunks = [];
  for (let i = 0; i < calendarIds.length; i += 50) {
    chunks.push(calendarIds.slice(i, i + 50));
  }

  const allBusy = [];

  for (const chunk of chunks) {
    try {
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: startISO,
          timeMax: endISO,
          items: chunk.map(id => ({ id })),
        },
      });

      const calendars = res.data.calendars || {};
      for (const calId of Object.keys(calendars)) {
        const busy = calendars[calId].busy || [];
        for (const window of busy) {
          allBusy.push({
            source_external_id: calId,
            starts_at: window.start,
            ends_at: window.end,
            title: null,
          });
        }
      }
    } catch (e) {
      console.error("freeBusy error:", e.message);
    }
  }

  return allBusy;
}

export async function fetchEvents(connection, calendarId, startISO, endISO) {
  const auth = await getAuthClient(connection);
  const calendar = google.calendar({ version: "v3", auth });

  const events = [];
  let pageToken = undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: startISO,
      timeMax: endISO,
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
      maxResults: 250,
    });

    for (const ev of (res.data.items || [])) {
      if (!ev.start) continue;
      const isAllDay = !!ev.start.date;
      const startsAt = ev.start.dateTime || (ev.start.date ? ev.start.date + "T00:00:00Z" : null);
      const endsAt = ev.end?.dateTime || (ev.end?.date ? ev.end.date + "T00:00:00Z" : null);
      if (!startsAt || !endsAt) continue;
      events.push({
        source_external_id: calendarId,
        starts_at: startsAt,
        ends_at: endsAt,
        title: ev.summary || "Busy",
        is_all_day: isAllDay,
      });
    }

    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return events;
}
