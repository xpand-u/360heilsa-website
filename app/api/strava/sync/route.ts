/**
 * POST /api/strava/sync
 * Accepts an array of processed Strava activities and upserts them to Supabase.
 * Used by automation/strava-to-supabase.py.
 * Auth: Bearer HEALTH_INGEST_SECRET (same token as health ingest).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";

const athleteId    = process.env.RAFN_ATHLETE_ID!;
const INGEST_SECRET = process.env.HEALTH_INGEST_SECRET!;

export async function POST(req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth  = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!INGEST_SECRET || token !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let activities: any[];
  try {
    activities = await req.json();
    if (!Array.isArray(activities)) throw new Error("Expected array");
  } catch {
    return NextResponse.json({ error: "Invalid JSON — expected array of activities" }, { status: 400 });
  }

  const sb = createServerClient();

  const rows = activities.map((a: any) => ({
    athlete_id:         athleteId,
    strava_id:          a.id,
    strava_url:         a.strava_url || null,
    sport_type:         a.sport_type,
    name:               a.name || null,
    activity_date:      a.date,
    start_time:         a.start_time || null,
    distance_km:        a.distance_km || null,
    duration_min:       a.duration_min || null,
    elevation_gain_m:   a.elevation_gain_m || null,
    avg_hr:             a.avg_hr || null,
    max_hr:             a.max_hr || null,
    has_heartrate:      a.has_heartrate ?? false,
    avg_pace_min_km:    a.avg_pace_min_km || null,
    avg_speed_kmh:      a.avg_speed_kmh || null,
    cadence_spm:        a.cadence_spm || null,
    aerobic_efficiency: a.aerobic_efficiency || null,
    workout_type:       a.workout_type != null ? String(a.workout_type) : null,
    suffer_score:       a.suffer_score || null,
    perceived_exertion: a.perceived_exertion || null,
    calories:           a.calories || null,
    raw_payload:        a,
    updated_at:         new Date().toISOString(),
  }));

  const { error, count } = await sb
    .from("strava_activities")
    .upsert(rows, { onConflict: "athlete_id,strava_id" })
    .select("id");

  if (error) {
    console.error("Strava sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, upserted: count ?? rows.length });
}
