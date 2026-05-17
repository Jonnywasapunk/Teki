// api/calendar/connect/microsoft.js
// Starts the Microsoft OAuth flow (multi-tenant)

import { getUserFromToken } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    return res.status(500).json({ error: "Microsoft OAuth not configured on server" });
  }

  const state = Buffer.from(JSON.stringify({
    user_id: user.id,
    ts: Date.now(),
  })).toString("base64url");

  const redirectUri = process.env.MICROSOFT_REDIRECT_URI ||
    "https://teki.dcdbgroup.com/api/calendar/callback/microsoft";

  const scopes = [
    "offline_access",
    "openid",
    "profile",
    "email",
    "User.Read",
    "Calendars.Read",
  ].join(" ");

  // /common endpoint supports any Azure AD tenant + personal Microsoft accounts (multi-tenant)
  const authUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" +
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: scopes,
      state: state,
      prompt: "select_account",
    }).toString();

  return res.status(200).json({ url: authUrl });
}
