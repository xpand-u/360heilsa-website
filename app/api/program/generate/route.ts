/**
 * POST /api/program/generate
 * Franklin generates a complete 4-6 week training block from scratch.
 * Inserts sessions into the DB and creates a training_blocks record.
 *
 * Body: { pivot?: boolean, new_goal?: string, pivot_context?: string }
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const maxDuration = 120;

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;
const client = new Anthropic();

const DAY_OFFSETS: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};

function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const daysToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + daysToMonday);
  return d;
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  const { pivot = false, new_goal, pivot_context } = await req.json().catch(() => ({}));

  const sb = createServerClient();

  // ── Gather athlete context ─────────────────────────────────────────────────
  const [athleteRes, logsRes, healthRes, assessRes, blockRes] = await Promise.all([
    sb.from("athletes")
      .select("full_name, goals, goals_structured, training_schedule, movement_results, training_age_years, gym, coach_notes")
      .eq("id", ATHLETE_ID)
      .single(),
    sb.from("session_logs")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .order("log_date", { ascending: false })
      .limit(20),
    sb.from("health_metrics")
      .select("hrv_sdnn, sleep_total_h, resting_hr, readiness_call, metric_date")
      .eq("athlete_id", ATHLETE_ID)
      .order("metric_date", { ascending: false })
      .limit(14),
    sb.from("assessments")
      .select("dominant_pattern, shoulder_finding, full_notes_md")
      .eq("athlete_id", ATHLETE_ID)
      .order("assessment_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("training_blocks")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const athlete   = athleteRes.data;
  const logs      = logsRes.data || [];
  const health    = healthRes.data || [];
  const assess    = assessRes.data;
  const prevBlock = blockRes.data;

  // Build training days from schedule
  const schedule = athlete?.training_schedule as { days?: { day: string; type: string; time?: string }[] } | null;
  const trainingDays = schedule?.days?.length
    ? schedule.days.sort((a, b) => (DAY_OFFSETS[a.day] ?? 7) - (DAY_OFFSETS[b.day] ?? 7))
    : [{ day: "mon", type: "lifting" }, { day: "wed", type: "lifting" }, { day: "fri", type: "lifting" }];

  const sessionsPerWeek = trainingDays.length;

  // Determine goal
  const activeGoal = new_goal || athlete?.goals || athlete?.goals_structured?.goals || "Build general fitness and strength";

  // ── Build prompt ───────────────────────────────────────────────────────────
  const moveSummary = athlete?.movement_results
    ? Object.entries(athlete.movement_results as Record<string, Record<string, string>>)
        .filter(([, v]) => !v.skipped)
        .map(([test, answers]) => `${test}: ${JSON.stringify(answers)}`)
        .join("\n")
    : "No movement screen data";

  const logSummary = logs.length
    ? logs.slice(0, 10).map(l =>
        `${l.log_date} — ${l.session_type} | RPE ${l.rpe_overall ?? "?"} | ${
          l.top_sets?.length ? l.top_sets.map((s: any) => `${s.exercise} ${s.load_kg}kg ${s.sets}×${s.reps}`).join(", ") : "no sets logged"
        }`
      ).join("\n")
    : "No prior session logs";

  const healthSummary = health.length
    ? health.map(h => `${h.metric_date}: ${h.readiness_call ?? "?"} | HRV ${h.hrv_sdnn ?? "?"}ms | Sleep ${h.sleep_total_h ?? "?"}h`).join("\n")
    : "No health data";

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const system = `You are Coach Franklin — a military veteran turned elite performance coach with expertise in block periodization, movement quality, and long-term athlete development. Today is ${today}.

You are generating a complete, practical training block for an athlete. Your output must be VALID JSON that can be parsed programmatically. Do not write anything outside the JSON object.

## ATHLETE
Name: ${athlete?.full_name || "Athlete"}
Goal: ${activeGoal}${pivot_context ? `\nContext for change: ${pivot_context}` : ""}
Training age: ${athlete?.training_age_years || "Unknown"} years
Environment: ${athlete?.gym || "Unknown"}
Training days/week: ${sessionsPerWeek} (${trainingDays.map(d => d.day + " " + d.type).join(", ")})

## MOVEMENT SCREEN
${moveSummary}

## POSTURAL ASSESSMENT
Dominant pattern: ${assess?.dominant_pattern || "Not assessed"}
Shoulder finding: ${assess?.shoulder_finding || "None noted"}

## RECENT TRAINING LOG (most recent first)
${logSummary}

## RECENT HEALTH DATA
${healthSummary}

## PRIOR BLOCK
${prevBlock ? `${prevBlock.name} (${prevBlock.phase || "unknown phase"}, week ${prevBlock.week ?? "?"} of ${prevBlock.planned_weeks})` : "None — this is the first real block"}

---

Generate a ${pivot ? "new" : "4-6 week"} training block that progresses this athlete toward their stated goal. Use what you know about their movement, recovery, and prior training to make this specific and appropriate.

OUTPUT FORMAT — return ONLY this JSON, nothing else:

{
  "block": {
    "name": "Block name (e.g. 'Strength Foundation — Accumulation')",
    "intent": "2-3 sentences on what this block is building and why",
    "phase": "accumulation | intensification | realization | transition",
    "planned_weeks": 4,
    "deload_after_weeks": 4
  },
  "sessions": [
    {
      "week": 1,
      "day": "monday",
      "type": "lifting | run | jits | other",
      "label": "Short session name (e.g. 'Lower A — Squat Focus')",
      "content_md": "Full session in plain text. Each exercise on its own line: Exercise — Sets×Reps @ load/RPE guidance. Include coaching cue on next line in italics (*cue*). Include section headers (A. Strength, B. Accessory, C. Conditioning). Be specific — real load guidance, real exercises.",
      "content_yellow_md": "Modified version for yellow readiness (tired, sub-optimal). Drop 1 set from main lifts, reduce intensity 5-10%, keep movement quality priority. Write out the full modified session briefly.",
      "content_red_md": "Active recovery version for red readiness. Light movement, mobility, no heavy loading. Write what to actually do.",
      "metadata": {
        "duration_target": "60-75 min",
        "expected_rpe": 7,
        "shoulder_risk": "low | moderate | high",
        "key_lift": "Primary exercise name"
      }
    }
  ]
}

Generate ALL sessions for ALL ${Math.min(sessionsPerWeek * 4, 20)} planned training days (${sessionsPerWeek} sessions × 4 weeks). Number weeks 1-4. Use the athlete's actual training days: ${trainingDays.map(d => d.day).join(", ")}. Progressively overload across weeks. Week 4 can be a deload if appropriate.`;

  // ── Call Claude (non-streaming — need to parse JSON) ──────────────────────
  let generated: { block: any; sessions: any[] } | null = null;
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: "Generate the training block." }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON — Claude may wrap in ```json ... ``` sometimes
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) generated = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Program generation failed:", err);
    return NextResponse.json({ error: "Failed to generate program" }, { status: 500 });
  }

  if (!generated?.block || !generated?.sessions?.length) {
    return NextResponse.json({ error: "Invalid program output" }, { status: 500 });
  }

  // ── If pivot, mark old block as pivoted ────────────────────────────────────
  if (pivot && prevBlock) {
    await sb.from("training_blocks")
      .update({ status: "completed", status_detail: "pivoted" })
      .eq("id", prevBlock.id);

    if (new_goal) {
      await sb.from("goal_pivots").insert({
        athlete_id:    ATHLETE_ID,
        previous_goal: athlete?.goals || null,
        new_goal,
        franklin_note: pivot_context || null,
        old_block_id:  prevBlock.id,
      });
      // Update athlete goals
      await sb.from("athletes")
        .update({ goals: new_goal, goals_structured: { goals: new_goal } })
        .eq("id", ATHLETE_ID);
    }
  } else if (prevBlock) {
    // Mark existing block as completed (not pivoted)
    await sb.from("training_blocks")
      .update({ status: "completed", status_detail: "completed" })
      .eq("id", prevBlock.id);
  }

  // ── Insert new training block ──────────────────────────────────────────────
  const blockStart = nextMonday();
  const deloadDue = addDays(blockStart, (generated.block.deload_after_weeks || generated.block.planned_weeks) * 7);

  const { data: newBlock, error: blockErr } = await sb
    .from("training_blocks")
    .insert({
      athlete_id:    ATHLETE_ID,
      name:          generated.block.name,
      intent:        generated.block.intent,
      phase:         generated.block.phase,
      planned_weeks: generated.block.planned_weeks,
      deload_due:    deloadDue,
      status:        "active",
      status_detail: "active",
      started_at:    blockStart.toISOString().split("T")[0],
      generated_at:  new Date().toISOString(),
      goal_snapshot: { goal: activeGoal },
    })
    .select("id")
    .single();

  if (blockErr || !newBlock) {
    return NextResponse.json({ error: blockErr?.message || "Block insert failed" }, { status: 500 });
  }

  // ── Map sessions to actual dates and insert ────────────────────────────────
  const sessionRows: Record<string, unknown>[] = [];
  const weeklyStatRows: Record<string, unknown>[] = [];

  for (let week = 1; week <= generated.block.planned_weeks; week++) {
    const weekStart = new Date(blockStart);
    weekStart.setDate(blockStart.getDate() + (week - 1) * 7);

    // Find sessions for this week
    const weekSessions = generated.sessions.filter((s: any) => s.week === week);

    // Match sessions to actual training days
    // If the session specifies a day, use it; otherwise map by index to training days
    for (let i = 0; i < weekSessions.length; i++) {
      const s = weekSessions[i];
      const dayKey = s.day?.toLowerCase().slice(0, 3); // "monday" -> "mon"
      const trainingDay = trainingDays.find(d => s.day?.toLowerCase().startsWith(d.day)) || trainingDays[i % trainingDays.length];
      const offset = DAY_OFFSETS[trainingDay.day] ?? i * 2;
      const scheduledDate = addDays(weekStart, offset);

      sessionRows.push({
        athlete_id:         ATHLETE_ID,
        block_id:           newBlock.id,
        scheduled_date:     scheduledDate,
        session_type:       s.type || trainingDay.type || "lifting",
        label:              s.label,
        content_md:         s.content_md,
        content_yellow_md:  s.content_yellow_md || null,
        content_red_md:     s.content_red_md || null,
        status:             "planned",
        metadata:           s.metadata || {},
        notes:              null,
      });
    }

    // Weekly state row
    weeklyStatRows.push({
      athlete_id:        ATHLETE_ID,
      week_start_date:   weekStart.toISOString().split("T")[0],
      sessions_planned:  weekSessions.length || sessionsPerWeek,
      sessions_completed: 0,
    });
  }

  // Insert sessions
  const { error: sessErr } = await sb.from("sessions").insert(sessionRows);
  if (sessErr) {
    console.error("Session insert error:", sessErr);
    return NextResponse.json({ error: "Sessions insert failed: " + sessErr.message }, { status: 500 });
  }

  // Insert weekly state rows (ignore conflicts if week already exists)
  await sb.from("weekly_state").upsert(weeklyStatRows, { onConflict: "athlete_id,week_start_date", ignoreDuplicates: true });

  return NextResponse.json({
    ok: true,
    block: { ...generated.block, id: newBlock.id, starts: blockStart.toISOString().split("T")[0] },
    sessionCount: sessionRows.length,
  });
}
