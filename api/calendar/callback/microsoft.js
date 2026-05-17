// api/calendar/callback/microsoft.js
// Handles Microsoft OAuth callback after user grants consent

import { encrypt } from "../lib/crypto.js";
import { db } from "../lib/supabase.js";
import { fetchUserProfile, fetchCalendarList } from "../lib/microsoft.js";

export default async function handler(req, res) {
  const { code, state, error: oauthError, error_description } = req.query;

  const redirectBack = (status, message) => {
    const url = "https://teki.dcdbgroup.com/?calendar_status=" + status + "&message=" + encodeURIComponent(message || "");
    res.writeHead(302, { Location: url });
    res.end();
  };

  if (oauthError) {
    return redirectBack("error", "Microsoft denied: " + (error_description || oauthError));
  }
  if (!code || !state) {
    return redirectBack("error", "Missing code or state from Microsoft");
  }

  let userId = null;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    userId = decoded.user_id;
    if (!userId || Date.now() - decoded.ts > 10 * 60 * 1000) {
      return redirectBack("error", "OAuth state expired or invalid");
    }
  } catch {
    return redirectBack("error", "Invalid OAuth state");
  }

  const redirectUri = process.env.MICROSOFT_REDIRECT_URI ||
    "https://teki.dcdbgroup.com/api/calendar/callback/microsoft";

  try {
    // Exchange code for tokens
    const body = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      code: code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: "offline_access openid profile email User.Read Calendars.Read",
    });

    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      console.error("Microsoft token exchange failed:", tokens);
      return redirectBack("error", "Token exchange failed: " + (tokens.error_description || tokens.error || "unknown"));
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    // Build a temp connection object to use lib/microsoft.js helpers for the profile call
    const tempConn = {
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      token_expires_at: expiresAt,
    };

    // Get user's email
    let accountEmail = "unknown@microsoft";
    try {
      const profile = await fetchUserProfile(tempConn);
      accountEmail = profile.mail || profile.userPrincipalName || accountEmail;
    } catch (e) {
      console.error("Failed to fetch MS user profile:", e.message);
    }

    // Upsert connection
    const connectionRow = {
      user_id: userId,
      provider: "microsoft",
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
      console.error("Failed to save MS connection:", connError);
      return redirectBack("error", "Failed to save connection");
    }

    // Discover calendars
    let calendars = [];
    try {
      calendars = await fetchCalendarList(connection);
    } catch (e) {
      console.error("Failed to list MS calendars:", e.message);
    }

    let calCount = 0;
    for (const cal of calendars) {
      const isPrimary = cal.isDefaultCalendar === true || cal.name === "Calendar";
      await db.upsert("calendar_sources", {
        connection_id: connection.id,
        user_id: userId,
        external_id: cal.id,
        display_name: cal.name || accountEmail,
        color: cal.hexColor || null,
        is_enabled: isPrimary,
        visibility_level: "busy_only",
      }, "connection_id,external_id");
      calCount++;
    }

    return redirectBack("success", "Connected " + accountEmail + " (" + calCount + " calendars)");
  } catch (e) {
    console.error("MS callback error:", e);
    return redirectBack("error", "OAuth failed: " + (e.message || "unknown"));
  }
}
