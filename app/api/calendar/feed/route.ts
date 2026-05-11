/**
 * GET /api/calendar/feed?token=[calendarToken]
 * Returns an ICS feed of the athlete's scheduled training sessions.
 * Use webcal:// prefix on the URL for one-tap iOS/Android calendar subscription.
 * Auto-refreshes based on training_schedule days; calendar apps poll every few hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const DAY_NAMES: Record<string, number> = {
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
};

const SESSION_LABELS: Record<string, string> = {
  lifting: "Lifting Session",
  run:     "Run",
  jits:    "BJJ / Jits",
  hike:    "Hike",
  other:   "Training Session",
};

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function nextOccurrence(dayOfWeek: number, fromDate: Date): Date {
  const d = new Date(fromDate);
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  const sb = createServerClient();

  // Look up athlete by calendar token
  const { data: athlete, error } = await sb
    .from("athletes")
    .select("id, full_name, training_schedule")
    .eq("calendar_token", token)
    .single();

  if (error || !athlete) {
    return new NextResponse("Not found", { status: 404 });
  }

  const schedule = athlete.training_schedule as {
    days: { day: string; type: string; time: string; duration?: number }[];
  } | null;

  const events: string[] = [];
  const now = new Date();
  const uid_base = `cf-${athlete.id}`;

  if (schedule?.days?.length) {
    // Generate 8 weeks of recurring events
    for (const slot of schedule.days) {
      const dayNum = DAY_NAMES[slot.day.toLowerCase()];
      if (dayNum === undefined) continue;

      // Parse "HH:MM" time string; fall back to legacy preset labels
      let timeHour = 7;
      let timeMin = 0;
      if (/^\d{1,2}:\d{2}$/.test(slot.time || "")) {
        const [h, m] = slot.time.split(":").map(Number);
        timeHour = h;
        timeMin = m;
      } else {
        timeHour = slot.time === "afternoon" ? 12 : slot.time === "evening" ? 18 : 7;
      }

      for (let week = 0; week < 8; week++) {
        const base = new Date(now);
        base.setDate(base.getDate() + week * 7);
        const occurrence = nextOccurrence(dayNum, week === 0 ? now : base);

        const durationMins = slot.duration || 90;
        const start = new Date(occurrence);
        start.setHours(timeHour, timeMin, 0, 0);
        const end = new Date(start);
        end.setTime(start.getTime() + durationMins * 60 * 1000);

        const uid = `${uid_base}-${slot.day}-w${week}@coachfranklin`;
        const label = SESSION_LABELS[slot.type] || "Training Session";

        events.push([
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTART:${formatICSDate(start)}`,
          `DTEND:${formatICSDate(end)}`,
          `SUMMARY:🏋️ ${label}`,
          `DESCRIPTION:Coach Franklin — ${label}\\nTo reschedule\\, open the 360 Health app. Changes made here won't sync back.`,
          `LOCATION:`,
          "END:VEVENT",
        ].join("\r\n"));
      }
    }
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Coach Franklin//Training Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Coach Franklin — ${athlete.full_name}`,
    "X-WR-TIMEZONE:UTC",
    "X-WR-CALDESC:Your Coach Franklin training schedule. Updates automatically.",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="coach-franklin.ics"',
      "Cache-Control": "no-cache, max-age=0",
    },
  });
}
