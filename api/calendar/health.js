// api/calendar/health.js
// Diagnostic — confirms env vars are loaded (without leaking values)
// DELETE THIS FILE BEFORE GOING TO PRODUCTION

export default async function handler(req, res) {
  const checks = {
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "(missing)",
    CALENDAR_ENCRYPTION_KEY_set: !!process.env.CALENDAR_ENCRYPTION_KEY,
    CALENDAR_ENCRYPTION_KEY_valid_length: process.env.CALENDAR_ENCRYPTION_KEY
      ? Buffer.from(process.env.CALENDAR_ENCRYPTION_KEY, "base64").length === 32
      : false,
    SUPABASE_URL: process.env.SUPABASE_URL || "(missing)",
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: checks,
  });
}
