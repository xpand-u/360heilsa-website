/**
 * GET /api/onboarding/status
 * Returns onboarding completion status and saved data for the athlete.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";


export async function GET() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();

  const { data, error } = await sb
    .from("athletes")
    .select("onboarding_complete, onboarding_data, training_schedule, movement_results, calendar_token")
    .eq("id", athleteId)
    .single();

  if (error) {
    return NextResponse.json({ onboarding_complete: false });
  }

  return NextResponse.json({
    onboarding_complete: data?.onboarding_complete ?? false,
    onboarding_data:     data?.onboarding_data     ?? null,
    training_schedule:   data?.training_schedule   ?? null,
    movement_results:    data?.movement_results     ?? null,
    calendar_token:      data?.calendar_token       ?? null,
  });
}
