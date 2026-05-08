/**
 * GET /api/dashboard/assessment
 * Returns limitations, shoulder log entries, and formal assessments.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function GET() {
  const sb = createServerClient();

  const [limitationsRes, logsRes, assessmentsRes] = await Promise.all([
    sb.from("limitations")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .order("started_date", { ascending: false }),

    sb.from("limitation_logs")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .order("log_date", { ascending: false })
      .limit(30),

    sb.from("assessments")
      .select("id, assessment_date, dominant_pattern, shoulder_finding, full_notes_md, photos, discussion, created_at")
      .eq("athlete_id", ATHLETE_ID)
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
