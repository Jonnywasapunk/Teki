// api/calendar/lib/ical.js
// iCal feed client — fetches and parses ICS data for free/busy

import ical from "node-ical";

export async function fetchIcalBusy(connection, calendarSource, startISO, endISO) {
  const url = connection.ical_url;
  if (!url) return [];

  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();

  try {
    const data = await ical.async.fromURL(url, {
      headers: { "User-Agent": "Teki-Calendar/1.0" },
    });

    const busy = [];

    for (const key of Object.keys(data)) {
      const event = data[key];
      if (event.type !== "VEVENT") continue;

      const start = event.start;
      const end = event.end;
      if (!start || !end) continue;

      const startTs = start.getTime();
      const endTs = end.getTime();

      // Filter to the requested time window
      if (endTs < startMs || startTs > endMs) continue;

      busy.push({
        source_external_id: calendarSource.external_id,
        starts_at: new Date(startTs).toISOString(),
        ends_at: new Date(endTs).toISOString(),
        title: calendarSource.visibility_level === "full_details" ? (event.summary || "Busy") : null,
        is_all_day: !!event.datetype && event.datetype === "date",
      });
    }

    return busy;
  } catch (e) {
    console.error("iCal fetch error:", e.message);
    return [];
  }
}
