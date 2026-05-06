import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function POST(_req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const [sessionRes, healthRes, blockRes, weekRes, limitRes] =
    await Promise.all([
      sb
        .from("next_session")
        .select("*")
        .eq("athlete_id", ATHLETE_ID)
        .maybeSingle(),
      sb
        .from("health_metrics")
        .select("*")
        .eq("athlete_id", ATHLETE_ID)
        .eq("metric_date", today)
        .maybeSingle(),
      sb
        .from("training_blocks")
        .select("*")
        .eq("athlete_id", ATHLETE_ID)
        .eq("status", "active")
        .maybeSingle(),
      sb
        .from("weekly_state")
        .select("*")
        .eq("athlete_id", ATHLETE_ID)
        .order("week_start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("limitations")
        .select("*")
        .eq("athlete_id", ATHLETE_ID)
        .neq("status", "resolved"),
    ]);

  // Health fallback to most recent if today missing
  let health = healthRes.data;
  let healthDate = today;
  if (!health) {
    const fallback = await sb
      .from("health_metrics")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    health = fallback.data;
    healthDate = fallback.data?.metric_date || today;
  }

  // Last 7 days health for trend
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const trendRes = await sb
    .from("health_metrics")
    .select("metric_date,hrv_sdnn,sleep_total_h,resting_hr,readiness_call")
    .eq("athlete_id", ATHLETE_ID)
    .gte("metric_date", sevenAgo.toISOString().split("T")[0])
    .order("metric_date");

  const session = sessionRes.data;
  const block = blockRes.data;
  const week = weekRes.data;
  const limitations = limitRes.data || [];
  const trend = trendRes.data || [];

  const weekNum = block
    ? Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(block.started_at).getTime()) /
            (1000 * 60 * 60 * 24 * 7)
        )
      )
    : null;

  const prompt = `Generate a concise morning training brief for Rafn (${today}).

READINESS${healthDate !== today ? ` (from ${healthDate})` : ""}:
- Status: ${health?.readiness_call || "unknown"}
- HRV: ${health?.hrv_sdnn ?? "—"}ms
- Sleep: ${health?.sleep_total_h ?? "—"}h
- RHR: ${health?.resting_hr ?? "—"}bpm
- Recovery score: ${health?.ultrahuman_score ?? "—"}
- Notes: ${health?.notes || "none"}

7-DAY TREND:
${trend.map((r: any) => `${r.metric_date}: ${r.readiness_call || "—"} | HRV ${r.hrv_sdnn ?? "—"} | Sleep ${r.sleep_total_h ?? "—"}h`).join("\n") || "No trend data"}

TODAY'S SESSION:
${session ? `${session.session_label} (${session.session_type})\n${session.content_md?.slice(0, 600)}` : "No session scheduled"}

BLOCK: ${block ? `${block.name}, vika ${weekNum} af ${block.planned_weeks}` : "None"}
WEEK: ${week ? `${week.sessions_completed}/${week.sessions_planned} lokið` : "No data"}
ACTIVE LIMITATIONS: ${limitations.length > 0 ? limitations.map((l: any) => `${l.limitation_type}: ${l.status}`).join(", ") : "None"}

Write a focused morning brief (4–6 bullet points). Include:
1. Go / modify / rest call — be decisive based on readiness + trend
2. Specific load guidance if modifying (e.g. "cut working sets by 1, drop intensity by 10%")
3. Key focus cues for the session (1-2 technical priorities)
4. Any flags: shoulder risk, deload proximity, sleep debt
5. One sharp motivational line at the end

No fluff. Direct. All in English.`;

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch {
        controller.enqueue(encoder.encode("Villa við að búa til dagskrá."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
