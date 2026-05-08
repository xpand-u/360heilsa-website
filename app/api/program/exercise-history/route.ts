/**
 * GET /api/program/exercise-history?exercise=NAME
 * Returns last 8 logged performances for a given exercise name (case-insensitive fuzzy match).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function GET(req: NextRequest) {
  const exercise = req.nextUrl.searchParams.get("exercise")?.trim();
  if (!exercise || exercise.length < 2) {
    return NextResponse.json({ history: [] });
  }

  const sb = createServerClient();

  // Get recent logs that have top_sets
  const { data: logs } = await sb
    .from("session_logs")
    .select("log_date, top_sets, session_type")
    .eq("athlete_id", ATHLETE_ID)
    .not("top_sets", "is", null)
    .order("log_date", { ascending: false })
    .limit(60);

  if (!logs?.length) return NextResponse.json({ history: [] });

  const term = exercise.toLowerCase();
  const results: { date: string; sets: number | null; reps: string | null; load_kg: number | null }[] = [];

  for (const log of logs) {
    if (!Array.isArray(log.top_sets)) continue;
    for (const s of log.top_sets as any[]) {
      if (typeof s.exercise === "string" && s.exercise.toLowerCase().includes(term)) {
        results.push({
          date:    log.log_date,
          sets:    s.sets ?? null,
          reps:    s.reps ?? null,
          load_kg: s.load_kg ?? null,
        });
        break; // one match per session log
      }
    }
    if (results.length >= 8) break;
  }

  return NextResponse.json({ history: results });
}
