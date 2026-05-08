/**
 * POST /api/dashboard/session
 * Saves a structured post-session log to session_logs.
 *
 * GET /api/dashboard/session
 * Returns the last 30 session logs.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";


export async function POST(req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    session_type,
    log_date,
    duration_min,
    rpe_overall,
    shoulder_status,
    top_sets,
    notes,
    label,
  } = await req.json();

  if (!session_type) {
    return NextResponse.json({ error: "session_type required" }, { status: 400 });
  }

  const sb = createServerClient();
  const date = log_date || new Date().toISOString().split("T")[0];

  const row: Record<string, unknown> = {
    athlete_id:   athleteId,
    log_date:     date,
    session_type,
  };
  if (label)          row.label          = label;
  if (duration_min)   row.duration_min   = Number(duration_min);
  if (rpe_overall)    row.rpe_overall    = Number(rpe_overall);
  if (shoulder_status) row.shoulder_status = shoulder_status;
  if (top_sets?.length) row.top_sets     = top_sets;
  if (notes?.trim())  row.notes          = notes.trim();

  const { data, error } = await sb
    .from("session_logs")
    .insert(row)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also mark the planned session as completed if one exists for this date
  await sb.from("sessions")
    .update({ status: "completed" })
    .eq("athlete_id", athleteId)
    .eq("scheduled_date", date)
    .eq("status", "planned");

  // ── PR Detection ──────────────────────────────────────────────────────────
  const prs: { exercise: string; weight: number; reps: string; previous_best: number }[] = [];

  if (top_sets?.length > 0 && data?.id) {
    const { data: allLogs } = await sb
      .from("session_logs")
      .select("id, top_sets")
      .eq("athlete_id", athleteId)
      .neq("id", data.id)
      .not("top_sets", "is", null)
      .order("log_date", { ascending: false })
      .limit(300);

    for (const topSet of top_sets) {
      if (!topSet.exercise || !topSet.load_kg || topSet.load_kg <= 0) continue;

      const exerciseLower = topSet.exercise.toLowerCase().trim();
      const currReps      = parseFloat(String(topSet.reps || 0)) || 0;

      const history: number[] = [];

      for (const log of (allLogs || [])) {
        for (const s of (log.top_sets || [])) {
          if (!s.exercise || !s.load_kg) continue;
          const sName = s.exercise.toLowerCase().trim();
          // Fuzzy name match — one must contain the other (min 4 chars)
          const nameMatch =
            exerciseLower.length >= 4 && sName.includes(exerciseLower) ||
            sName.length >= 4 && exerciseLower.includes(sName);
          if (!nameMatch) continue;
          const sReps = parseFloat(String(s.reps || 0)) || 0;
          if (Math.abs(sReps - currReps) <= 1) {
            history.push(s.load_kg);
          }
        }
      }

      if (history.length >= 3) {
        const prevBest = Math.max(...history);
        if (topSet.load_kg > prevBest) {
          prs.push({
            exercise:     topSet.exercise,
            weight:       topSet.load_kg,
            reps:         String(topSet.reps || currReps),
            previous_best: prevBest,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true, id: data.id, prs });
}

export async function GET() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();
  const { data } = await sb
    .from("session_logs")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("log_date", { ascending: false })
    .limit(30);

  return NextResponse.json({ logs: data || [] });
}
