/**
 * POST /api/dashboard/foundation-debrief
 * Franklin reviews the athlete's first week of data and delivers a debrief.
 * Streams the response. Called after 7+ days since onboarding completion.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";

export const maxDuration = 60;

const client = new Anthropic();

export async function POST() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();

  // Gather the past 14 days of data
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const since = twoWeeksAgo.toISOString().split("T")[0];

  const [athleteRes, logsRes, healthRes, movementRes] = await Promise.all([
    sb.from("athletes")
      .select("full_name, onboarding_data, training_schedule, movement_results, goals")
      .eq("id", athleteId)
      .single(),
    sb.from("session_logs")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("log_date", since)
      .order("log_date"),
    sb.from("health_metrics")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("metric_date", since)
      .order("metric_date"),
    sb.from("assessments")
      .select("dominant_pattern, shoulder_finding, full_notes_md")
      .eq("athlete_id", athleteId)
      .order("assessment_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const athlete    = athleteRes.data;
  const logs       = logsRes.data || [];
  const health     = healthRes.data || [];
  const assessment = movementRes.data;

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const sessionSummary = logs.length > 0
    ? logs.map(l =>
        `${l.log_date} — ${l.session_type} | ${l.duration_min ? `${l.duration_min}min` : "?"} | RPE ${l.rpe_overall ?? "?"} | ${l.shoulder_status ?? "no shoulder note"}${l.notes ? ` | "${l.notes}"` : ""}`
      ).join("\n")
    : "No sessions logged yet.";

  const healthSummary = health.length > 0
    ? health.map(h =>
        `${h.metric_date} — Sleep: ${h.sleep_total_h ?? "?"}h | HRV: ${h.hrv_sdnn ?? "?"}ms | RHR: ${h.resting_hr ?? "?"}bpm | Readiness: ${h.readiness_call ?? "?"}`
      ).join("\n")
    : "No health data recorded.";

  const movementSummary = athlete?.movement_results
    ? JSON.stringify(athlete.movement_results, null, 2)
    : "No movement screen results recorded.";

  const system = `You are Coach Franklin — a military veteran turned elite performance coach. Today is ${today}.

You have just completed Foundation Week with your athlete. This is your debrief: what you saw, what you learned, and what changes going into the real program.

## ATHLETE
Name: ${athlete?.full_name || "Athlete"}
Goals: ${athlete?.goals || "Not specified"}
Schedule: ${athlete?.training_schedule ? JSON.stringify(athlete.training_schedule) : "Not set"}

## MOVEMENT SCREEN RESULTS (from onboarding)
${movementSummary}

## POSTURAL SCREENING
Dominant pattern: ${assessment?.dominant_pattern || "Not assessed yet"}
Shoulder finding: ${assessment?.shoulder_finding || "None noted"}

## FOUNDATION WEEK — SESSION LOG
${sessionSummary}

## FOUNDATION WEEK — HEALTH DATA
${healthSummary}

---

Write your Foundation Week debrief. Structure:
1. What you observed (specific, tied to the actual data — don't make things up)
2. What surprised you or confirmed what you expected from the movement screen
3. What specifically changes going into Week 2 and why
4. One thing you want them focused on this week

Voice: Direct. Honest. Franklin's. This is a coach talking to an athlete they've just spent a week watching. Not a report — a conversation.

If there's no session data: acknowledge it directly. Ask them what happened. Don't pretend the data exists.
Keep it under 300 words. No bullet lists — prose.`;

  // Check if we already have a saved foundation debrief — return it if so
  const { data: existingDebrief } = await sb
    .from("program_debriefs")
    .select("content_md")
    .eq("athlete_id", athleteId)
    .eq("debrief_type", "foundation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDebrief?.content_md) {
    // Stream back the saved debrief so client-side code works the same
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(existingDebrief.content_md));
        controller.close();
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 500,
    system,
    messages: [{ role: "user", content: "Give me the Foundation Week debrief." }],
  });

  const encoder = new TextEncoder();
  let fullText = "";
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            fullText += chunk.delta.text;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        // Save the debrief after streaming completes
        if (fullText.trim()) {
          await sb.from("program_debriefs").insert({
            athlete_id:   athleteId,
            debrief_type: "foundation",
            content_md:   fullText.trim(),
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if Foundation Week is complete (7+ days since onboarding)
  const sb = createServerClient();
  const { data } = await sb
    .from("athletes")
    .select("onboarding_complete, onboarding_completed_at")
    .eq("id", athleteId)
    .single();

  if (!data?.onboarding_complete || !data?.onboarding_completed_at) {
    return NextResponse.json({ ready: false });
  }

  // Check if 7 days have passed since onboarding was completed
  const completedAt = new Date(data.onboarding_completed_at);
  const daysSince = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24);

  return NextResponse.json({ ready: daysSince >= 7, daysSince: Math.floor(daysSince) });
}
