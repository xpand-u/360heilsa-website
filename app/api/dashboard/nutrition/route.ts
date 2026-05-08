/**
 * GET /api/dashboard/nutrition
 * Returns the athlete's nutrition profile.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";


export async function GET() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();

  const { data } = await sb
    .from("nutrition_profiles")
    .select("*")
    .eq("athlete_id", athleteId)
    .maybeSingle();

  return NextResponse.json({ profile: data || null });
}
