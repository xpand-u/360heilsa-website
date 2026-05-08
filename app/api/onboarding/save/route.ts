/**
 * POST /api/onboarding/save
 * Saves completed onboarding data to the athlete record.
 * Marks onboarding_complete = true and generates a calendar token.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import crypto from "crypto";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function POST(req: NextRequest) {
  const { intake_data, schedule_data, movement_results, intake_summary } =
    await req.json();

  const sb = createServerClient();

  // Fetch existing record to preserve calendar_token if already set
  const { data: existing } = await sb
    .from("athletes")
    .select("calendar_token")
    .eq("id", ATHLETE_ID)
    .single();

  const calendarToken = existing?.calendar_token || crypto.randomBytes(16).toString("hex");

  // intake_data may be { summary: "text" } (old format) or a structured object from [INTAKE_DATA] token
  const structured = intake_data && typeof intake_data === "object" && intake_data.goals
    ? intake_data
    : null;

  const updatePayload: Record<string, unknown> = {
    onboarding_complete: true,
    onboarding_completed_at: new Date().toISOString(),
    calendar_token: calendarToken,
    onboarding_data: intake_data,
    coach_notes: intake_summary || null,
  };

  if (schedule_data)    updatePayload.training_schedule  = schedule_data;
  if (movement_results) updatePayload.movement_results   = movement_results;

  // Populate structured fields if we got parsed intake data
  if (structured) {
    if (structured.goals)              updatePayload.goals               = structured.goals;
    if (structured.training_age_years) updatePayload.training_age_years  = structured.training_age_years;
    if (structured.gym)                updatePayload.gym                 = structured.gym;
    // Cycle tracking fields
    if (structured.tracks_cycle != null) updatePayload.tracks_cycle     = structured.tracks_cycle;
    if (structured.avg_cycle_length)     updatePayload.avg_cycle_length  = structured.avg_cycle_length;
    if (structured.contraceptive_method) updatePayload.contraceptive_method = structured.contraceptive_method;
    // Store structured goals for program generation
    updatePayload.goals_structured = structured;
  }

  const { error } = await sb
    .from("athletes")
    .update(updatePayload)
    .eq("id", ATHLETE_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, calendarToken });
}
