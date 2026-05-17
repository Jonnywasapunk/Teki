// api/calendar/callback/google.js
// Handles Google OAuth callback after user grants consent

import { google } from "googleapis";
import { encrypt } from "../lib/crypto.js";
import { db } from "../lib/supabase.js";

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  // Helper to redirect back to Teki with a status message
  const redirectBack = (status, message) => {
    const url = "https://teki.dcdbgroup.com/?calendar_status=" + status + "&message=" + encodeURIComponent(message || "");
    res.writeHead(302, { Location: url });
    res.end();
  };

  if (oauthError) {
    return redirectBack("error", "Google denied access: " + oauthError);
  }
  if (!code || !state) {
    return redirectBack("error", "Missing code or state from Google");
  }

  // Decode the state to get user_id
  let userId = null;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    userId = decoded.user_id;
    // Reject states older than 10 minutes (CSRF protection)
    if (!userId || Date.now() - decoded.ts > 10 * 60 * 1000) {
      return redirectBack("error", "OAuth state expired or invalid");
    }
  } catch {
    return redirectBack("error", "Invalid OAuth state");
  }

  try {
    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || "https://teki.dcdbgroup.com/api/calendar/callback/google"
    );

    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token) {
      return redirectBack("error", "Google did not return an access token");
    }

    oauth2Client.setCredentials(tokens);

    // Get the user's email so we can label the connection
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userinfo = await oauth2.userinfo.get();
    const accountEmail = userinfo.data.email;

    // Calculate expiry timestamp
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    // Upsert the connection (encrypts tokens before storing)
    const connectionRow = {
      user_id: userId,
      provider: "google",
      account_email: accountEmail,
      account_label: accountEmail,
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      token_expires_at: expiresAt,
      is_active: true,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    };

    const { data: connection, error: connError } = await db.upsert(
      "calendar_connections",
      connectionRow,
      "user_id,provider,account_email"
    );

    if (connError || !connection) {
      console.error("Failed to save connection:", connError);
      return redirectBack("error", "Failed to save connection to database");
    }

    // Discover all the user's calendars
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();

    const sources = (calendarList.data.items || []).map(cal => ({
      connection_id: connection.id,
      user_id: userId,
      external_id: cal.id,
      display_name: cal.summary || cal.id,
      color: cal.backgroundColor || null,
      is_enabled: cal.primary === true,
      visibility_level: "busy_only",
    }));

    // Insert calendar sources (one row per discovered calendar)
    for (const source of sources) {
      await db.upsert("calendar_sources", source, "connection_id,external_id");
    }

    return redirectBack("success", "Connected " + accountEmail + " (" + sources.length + " calendars)");
  } catch (e) {
    console.error("Google OAuth callback error:", e);
    return redirectBack("error", "OAuth exchange failed: " + (e.message || "unknown"));
  }
}
