/**
 * GET /api/strava/activities?sport=Run&limit=50&offset=0
 * Returns Strava activities for the dashboard Running tab.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sport  = searchParams.get("sport");     // optional filter e.g. "Run"
  const limit  = Math.min(parseInt(searchParams.get("limit")  || "60"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");

  const sb = createServerClient();

  let query = sb
    .from("strava_activities")
    .select("strava_id,sport_type,name,activity_date,start_time,distance_km,duration_min,avg_hr,max_hr,avg_pace_min_km,avg_speed_kmh,aerobic_efficiency,elevation_gain_m,calories,strava_url,has_heartrate")
    .eq("athlete_id", ATHLETE_ID)
    .order("activity_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (sport) query = query.eq("sport_type", sport);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data || [], total: count });
}
