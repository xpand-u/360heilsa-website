/**
 * GET  /api/cycle/log — Returns most recent cycle logs + athlete cycle settings
 * POST /api/cycle/log — Logs a new period start date
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export function computeCyclePhase(
  lastPeriodStart: string,
  avgCycleLength = 28
): { phase: string; day: number; label: string; trainingNote: string } {
  const start   = new Date(lastPeriodStart);
  const today   = new Date();
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const cycleDay = (daysDiff % avgCycleLength) + 1;

  if (cycleDay <= 5) {
    return {
      phase:       "menstrual",
      day:         cycleDay,
      label:       "Menstrual",
      trainingNote: "Energy may be low. Check in with athlete on how they feel before pushing intensity.",
    };
  } else if (cycleDay <= 13) {
    return {
      phase:       "follicular",
      day:         cycleDay,
      label:       "Follicular",
      trainingNote: "Rising estrogen — performance window is opening. Good time to push.",
    };
  } else if (cycleDay <= 16) {
    return {
      phase:       "ovulatory",
      day:         cycleDay,
      label:       "Ovulatory",
      trainingNote: "Peak performance window. Note slightly elevated ligament laxity — cue movement quality.",
    };
  } else if (cycleDay <= 24) {
    return {
      phase:       "early_luteal",
      day:         cycleDay,
      label:       "Early Luteal",
      trainingNote: "Progesterone dominant — strength holds, recovery may be slightly slower.",
    };
  } else {
    return {
      phase:       "late_luteal",
      day:         cycleDay,
      label:       "Late Luteal",
      trainingNote: "PMS window — fatigue, bloating, mood shifts possible. Consider load reduction if readiness is borderline.",
    };
  }
}

export async function GET() {
  const sb = createServerClient();

  const [logsRes, athleteRes] = await Promise.all([
    sb.from("cycle_logs")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .order("period_start_date", { ascending: false })
      .limit(4),
    sb.from("athletes")
      .select("tracks_cycle, avg_cycle_length, contraceptive_method")
      .eq("id", ATHLETE_ID)
      .single(),
  ]);

  const logs    = logsRes.data || [];
  const athlete = athleteRes.data;

  let cyclePhase = null;
  if (athlete?.tracks_cycle && logs.length > 0) {
    cyclePhase = computeCyclePhase(logs[0].period_start_date, athlete.avg_cycle_length || 28);
  }

  return NextResponse.json({ logs, athlete, cyclePhase });
}

export async function POST(req: NextRequest) {
  const { period_start_date, notes } = await req.json();

  if (!period_start_date) {
    return NextResponse.json({ error: "period_start_date required" }, { status: 400 });
  }

  const sb = createServerClient();

  const { data: athlete } = await sb
    .from("athletes")
    .select("avg_cycle_length, tracks_cycle")
    .eq("id", ATHLETE_ID)
    .single();

  // Enable tracking if not already on
  if (!athlete?.tracks_cycle) {
    await sb.from("athletes").update({ tracks_cycle: true }).eq("id", ATHLETE_ID);
  }

  const { data, error } = await sb
    .from("cycle_logs")
    .insert({
      athlete_id:        ATHLETE_ID,
      period_start_date,
      cycle_length_est:  athlete?.avg_cycle_length || 28,
      notes:             notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, log: data });
}
