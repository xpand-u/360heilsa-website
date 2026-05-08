/**
 * POST /api/program/block-debrief
 * Franklin reviews the completed block and streams a debrief.
 * Saves to program_debriefs. Called when a block is complete.
 *
 * GET — check if current block is complete and if a debrief exists.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;
const client = new Anthropic();

export async function GET() {
  const sb = createServerClient();

  const { data: block } = await sb
    .from("training_blocks")
    .select("id, name, planned_weeks, started_at, status")
    .eq("athlete_id", ATHLETE_ID)
    .eq("status", "active")
    .maybeSingle();

  if (!block) return NextResponse.json({ blockComplete: false, hasDebrief: false });

  // Count completed sessions for this block
  const { count } = await sb
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("athlete_id", ATHLETE_ID)
    .eq("block_id", block.id)
    .eq("status", "completed");

  const { count: total } = await sb
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("athlete_id", ATHLETE_ID)
    .eq("block_id", block.id);

  // Block is "complete" if all planned weeks have passed or all sessions are done
  const weeksPassed = Math.floor(
    (Date.now() - new Date(block.started_at).getTime()) / (1000 * 60 * 60 * 24 * 7)
  );
  const blockComplete = weeksPassed >= block.planned_weeks || (total && count && count >= total);

  // Check for existing debrief
  const { data: debrief } = await sb
    .from("program_debriefs")
    .select("content_md")
    .eq("athlete_id", ATHLETE_ID)
    .eq("debrief_type", "block_end")
    .eq("block_id", block.id)
    .maybeSingle();

  return NextResponse.json({
    blockComplete,
    hasDebrief: !!debrief,
    debrief: debrief?.content_md || null,
    blockName: block.name,
    sessionsCompleted: count ?? 0,
    sessionsTotal: total ?? 0,
  });
}

export async function POST() {
  const sb = createServerClient();

  // Get current block
  const { data: block } = await sb
    .from("training_blocks")
    .select("*")
    .eq("athlete_id", ATHLETE_ID)
    .eq("status", "active")
    .maybeSingle();

  if (!block) {
    return NextResponse.json({ error: "No active block" }, { status: 400 });
  }

  // Check for existing debrief
  const { data: existing } = await sb
    .from("program_debriefs")
    .select("content_md")
    .eq("athlete_id", ATHLETE_ID)
    .eq("debrief_type", "block_end")
    .eq("block_id", block.id)
    .maybeSingle();

  if (existing?.content_md) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(existing.content_md));
        controller.close();
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Gather block data
  const since = block.started_at;
  const [athleteRes, sessionsRes, logsRes, healthRes] = await Promise.all([
    sb.from("athletes").select("full_name, goals").eq("id", ATHLETE_ID).single(),
    sb.from("sessions").select("*").eq("athlete_id", ATHLETE_ID).eq("block_id", block.id).order("scheduled_date"),
    sb.from("session_logs").select("*").eq("athlete_id", ATHLETE_ID).gte("log_date", since).order("log_date"),
    sb.from("health_metrics").select("*").eq("athlete_id", ATHLETE_ID).gte("metric_date", since).order("metric_date"),
  ]);

  const athlete  = athleteRes.data;
  const sessions = sessionsRes.data || [];
  const logs     = logsRes.data || [];
  const health   = healthRes.data || [];

  const completedSessions = sessions.filter(s => s.status === "completed").length;
  const missedSessions    = sessions.filter(s => s.status === "missed").length;
  const consistency       = sessions.length ? Math.round((completedSessions / sessions.length) * 100) : 0;

  const logSummary = logs.length
    ? logs.map(l =>
        `${l.log_date} — ${l.session_type} | RPE ${l.rpe_overall ?? "?"} | ${
          l.top_sets?.length ? l.top_sets.map((s: any) => `${s.exercise} ${s.load_kg}kg ${s.sets}×${s.reps}`).join(", ") : "no exercises logged"
        }${l.notes ? ` | "${l.notes}"` : ""}`
      ).join("\n")
    : "No sessions logged during this block.";

  const healthSummary = health.length
    ? health.map(h => `${h.metric_date}: ${h.readiness_call ?? "?"} | HRV ${h.hrv_sdnn ?? "?"}ms | Sleep ${h.sleep_total_h ?? "?"}h`).join("\n")
    : "No health data.";

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const system = `You are Coach Franklin — a military veteran turned elite performance coach. Today is ${today}.

You are delivering the end-of-block debrief for ${athlete?.full_name || "your athlete"}.

## BLOCK
Name: ${block.name}
Intent: ${block.intent || "Not specified"}
Phase: ${block.phase || "Unknown"}
Duration: ${block.planned_weeks} weeks
Consistency: ${completedSessions}/${sessions.length} sessions completed (${consistency}%) — ${missedSessions} missed

## SESSION LOG
${logSummary}

## HEALTH DATA
${healthSummary}

---

Write the block debrief. Structure:
1. What happened — be specific about the data. Consistency, load progression, any RPE trends.
2. What worked and what needs fixing — honest. Don't celebrate mediocrity.
3. What changes in the next block — specific shifts in training, not vague adjustments.
4. One thing that matters most going forward.

Voice: Direct. Coach talking to athlete. This is accountability time, not cheerleading. Keep it under 350 words. No bullet lists — prose.

If consistency was below 70%: lead with that. Name it. Address it before anything else.`;

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: "Give me the block debrief." }],
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
        if (fullText.trim()) {
          await sb.from("program_debriefs").insert({
            athlete_id:   ATHLETE_ID,
            debrief_type: "block_end",
            block_id:     block.id,
            content_md:   fullText.trim(),
            metadata:     { consistency, completed: completedSessions, total: sessions.length },
          });
          // Mark block as completed
          await sb.from("training_blocks")
            .update({ status: "completed", status_detail: "completed" })
            .eq("id", block.id);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
