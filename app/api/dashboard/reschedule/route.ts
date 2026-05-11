/**
 * PATCH /api/dashboard/reschedule
 * Moves a planned session to a new date.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";

export async function PATCH(req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, newDate } = await req.json();
  if (!sessionId || !newDate) {
    return NextResponse.json({ error: "sessionId and newDate required" }, { status: 400 });
  }

  const sb = createServerClient();

  const { error } = await sb
    .from("sessions")
    .update({ scheduled_date: newDate })
    .eq("id", sessionId)
    .eq("athlete_id", athleteId)   // ownership check
    .neq("status", "completed");   // can't move a completed session

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
