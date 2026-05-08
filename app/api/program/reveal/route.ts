/**
 * POST /api/program/reveal
 * Franklin presents a freshly generated training block with specific reasoning.
 * Streaming conversation — athlete can push back before green-lighting.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";

export const maxDuration = 60;

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, message, block } = await req.json() as {
    messages: { role: string; content: string }[];
    message: string | null;
    block: { name: string; intent: string; phase: string; planned_weeks: number };
  };

  const sb = createServerClient();

  const [athleteRes, assessRes, logsRes, healthRes] = await Promise.all([
    sb.from("athletes")
      .select("full_name, goals, training_age_years, gym")
      .eq("id", athleteId)
      .single(),
    sb.from("assessments")
      .select("dominant_pattern, shoulder_finding")
      .eq("athlete_id", athleteId)
      .order("assessment_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("session_logs")
      .select("log_date, session_type, rpe_overall, top_sets, notes")
      .eq("athlete_id", athleteId)
      .order("log_date", { ascending: false })
      .limit(8),
    sb.from("health_metrics")
      .select("hrv_sdnn, sleep_total_h, readiness_call")
      .eq("athlete_id", athleteId)
      .order("metric_date", { ascending: false })
      .limit(7),
  ]);

  const athlete = athleteRes.data;
  const assess  = assessRes.data;
  const logs    = logsRes.data || [];
  const health  = healthRes.data || [];

  const logSummary = logs.slice(0, 5).map(l =>
    `${l.log_date} — ${l.session_type} | RPE ${l.rpe_overall ?? "?"} | ${
      l.top_sets?.length
        ? l.top_sets.slice(0, 3).map((s: any) => `${s.exercise} ${s.load_kg}kg ${s.sets}×${s.reps}`).join(", ")
        : "no sets logged"
    }`
  ).join("\n");

  const validHrv   = health.filter(r => r.hrv_sdnn);
  const validSleep = health.filter(r => r.sleep_total_h);
  const avgHrv     = validHrv.length ? Math.round(validHrv.reduce((s, r) => s + r.hrv_sdnn, 0) / validHrv.length) : null;
  const avgSleep   = validSleep.length ? (validSleep.reduce((s, r) => s + r.sleep_total_h, 0) / validSleep.length).toFixed(1) : null;

  const history = (messages || []).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const isOpening = history.length === 0 && !message;

  const systemPrompt = `You are Coach Franklin — a military veteran turned elite performance coach. You've just built a complete training block for this athlete and are presenting your reasoning.

## ATHLETE
Name: ${athlete?.full_name || "Athlete"}
Goal: ${athlete?.goals || "Not specified"}
Training age: ${athlete?.training_age_years || "?"} years
Environment: ${athlete?.gym || "Unknown"}

## THE BLOCK YOU JUST BUILT
Name: ${block?.name}
Phase: ${block?.phase}
Duration: ${block?.planned_weeks} weeks
Your intent: ${block?.intent}

## WHAT YOU USED TO MAKE DECISIONS
Movement screen: ${assess?.dominant_pattern || "Not assessed"} | Shoulder: ${assess?.shoulder_finding || "No finding noted"}
Recent training (last 5 sessions):
${logSummary || "No prior logs — this is the starting point"}
Recovery baseline: HRV avg ${avgHrv ?? "?"}ms | Sleep avg ${avgSleep ?? "?"}h/night

## HOW TO PRESENT THIS

**Opening message (no history):**
One sharp line naming the block and what it's building toward. Then give 3 specific programming decisions tied to their actual data — not generic principles. Examples of what "specific" looks like:
- "Your movement screen showed restricted hip flexors on the right — that's why I front-loaded single-leg work in weeks 1-2 rather than going straight to bilateral."
- "Your HRV has been averaging ${avgHrv ?? "?"}ms which tells me your recovery is [adequate/stressed] — the session volume reflects that."
- "You haven't logged any heavy posterior chain work in the last [X] weeks, so I started conservative on the deadlift and programmed room to progress."
Then close with what they should realistically expect to feel by week ${block?.planned_weeks ?? 4} if they execute consistently. Keep this under 220 words. End with: "Green light, or is there anything you want to adjust before we start?"

**If they push back on something:**
Defend your choice with the actual data behind it. Be honest if they have a point. Offer a modified version if a genuine middle ground exists. Don't cave on things that matter for their development.

**If they approve:**
Brief, confident. Something like "Good. Starting Monday. I'll check in on how the first session goes." Then close it out.

**Voice:** Direct. Specific. Short sentences. Coach who has an opinion and isn't afraid to explain it. No filler.`;

  const allMessages = isOpening
    ? [{ role: "user" as const, content: "__OPEN__" }]
    : [...history, { role: "user" as const, content: message || "" }];

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 600,
    system: systemPrompt,
    messages: allMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
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
