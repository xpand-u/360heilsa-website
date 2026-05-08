/**
 * GET /api/dashboard/nutrition
 * Returns the athlete's nutrition profile.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function GET() {
  const sb = createServerClient();

  const { data } = await sb
    .from("nutrition_profiles")
    .select("*")
    .eq("athlete_id", ATHLETE_ID)
    .maybeSingle();

  return NextResponse.json({ profile: data || null });
}
