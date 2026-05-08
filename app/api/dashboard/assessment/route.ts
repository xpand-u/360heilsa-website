/**
 * GET /api/dashboard/assessment
 * Returns limitations, shoulder log entries, and formal assessments.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";


export async function GET() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();

  const [limitationsRes, logsRes, assessmentsRes] = await Promise.all([
    sb.from("limitations")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("started_date", { ascending: false }),

    sb.from("limitation_logs")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("log_date", { ascending: false })
      .limit(30),

    sb.from("assessments")
      .select("id, assessment_date, dominant_pattern, shoulder_finding, full_notes_md, photos, discussion, created_at")
      .eq("athlete_id", athleteId)
      .order("assessment_date", { ascending: false }),
  ]);

  const latestAssessment = assessmentsRes.data?.[0];

  return NextResponse.json({
    limitations:  limitationsRes.data  || [],
    logs:         logsRes.data         || [],
    assessments:  assessmentsRes.data  || [],
    latestReport: latestAssessment?.full_notes_md || null,
  });
}
