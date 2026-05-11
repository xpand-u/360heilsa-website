import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";


export async function POST(req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { notes, sessionDate, feedback } = await req.json();
  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  // Mark session as completed in sessions table
  const dateToMark = sessionDate || today;
  await sb.from("sessions")
    .update({ status: "completed" })
    .eq("athlete_id", athleteId)
    .eq("scheduled_date", dateToMark);

  // Update sessions_completed count in weekly_state
  const weekRes = await sb.from("weekly_state").select("*")
    .eq("athlete_id", athleteId)
    .order("week_start_date", { ascending: false })
    .limit(1).maybeSingle();

  if (weekRes.data) {
    await sb.from("weekly_state")
      .update({ sessions_completed: (weekRes.data.sessions_completed || 0) + 1 })
      .eq("id", weekRes.data.id);
  }

  // Add notes to scratch if provided
  if (notes?.trim()) {
    const time = new Date().toLocaleTimeString("is-IS", { hour: "2-digit", minute: "2-digit" });
    const scratchRes = await sb.from("session_scratch").select("*")
      .eq("athlete_id", athleteId)
      .eq("scratch_date", today)
      .eq("scratch_status", "active")
      .maybeSingle();

    if (scratchRes.data) {
      const entries = [...(scratchRes.data.entries || []), { time, note: `[Done] ${notes}` }];
      await sb.from("session_scratch").update({ entries, scratch_status: "processed" })
        .eq("id", scratchRes.data.id);
    }
  }

  // Save structured workout feedback to session_logs if provided
  if (feedback && typeof feedback === "object") {
    const existingLog = await sb.from("session_logs").select("id")
      .eq("athlete_id", athleteId)
      .eq("log_date", dateToMark)
      .maybeSingle();

    if (existingLog.data) {
      await sb.from("session_logs")
        .update({ workout_feedback: feedback })
        .eq("id", existingLog.data.id);
    } else {
      // Create a minimal log record to hold the feedback
      await sb.from("session_logs").insert({
        athlete_id: athleteId,
        log_date: dateToMark,
        session_type: "other",
        workout_feedback: feedback,
        notes: feedback.notes || null,
        rpe_overall: feedback.rpe || null,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
