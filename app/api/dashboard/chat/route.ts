import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function POST(req: NextRequest) {
  const { message, context } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sb = createServerClient();

  // Fetch current state for context
  const today = new Date().toISOString().split("T")[0];
  const [sessionRes, weekRes, healthRes, blockRes] = await Promise.all([
    sb.from("next_session").select("*").eq("athlete_id", ATHLETE_ID).maybeSingle(),
    sb.from("sessions").select("*").eq("athlete_id", ATHLETE_ID)
      .order("scheduled_date").limit(7),
    sb.from("health_metrics").select("*").eq("athlete_id", ATHLETE_ID)
      .eq("metric_date", today).maybeSingle(),
    sb.from("training_blocks").select("*").eq("athlete_id", ATHLETE_ID)
      .eq("status", "active").maybeSingle(),
  ]);

  const session = sessionRes.data;
  const weekSessions = weekRes.data || [];
  const health = healthRes.data;
  const block = blockRes.data;

  const systemPrompt = `You are 360 Heilsa Coach — Rafn Franklin's personal AI fitness coach. You are direct, knowledgeable, and opinionated. You adapt training based on recovery data and push back when needed.

Current date: ${today}

CURRENT SESSION:
${session ? `- Label: ${session.session_label}
- Type: ${session.session_type}
- Date: ${session.planned_date}
- Metadata: ${JSON.stringify(session.metadata)}
- Plan:
${session.content_md}` : "No session data available."}

THIS WEEK'S SESSIONS:
${weekSessions.map((s: any) => `- ${s.scheduled_date} ${s.session_type}: ${s.label} (${s.status})`).join("\n")}

TODAY'S READINESS:
${health ? `- Readiness: ${health.readiness_call}
- Sleep: ${health.sleep_total_h ?? "—"}h
- HRV: ${health.hrv_sdnn ?? "—"}ms
- Resting HR: ${health.resting_hr ?? "—"}bpm
- Ultrahuman: ${health.ultrahuman_score ?? "—"}
- Notes: ${health.notes || "none"}` : "No readiness data for today. Ask Rafn for subjective readiness."}

CURRENT BLOCK:
${block ? `- Name: ${block.name}
- Started: ${block.started_at}
- Planned weeks: ${block.planned_weeks}
- Deload due: ${block.deload_due}` : "No active block."}

${context ? `ADDITIONAL CONTEXT FROM USER:\n${context}` : ""}

Your role:
- Answer questions about today's session, the plan, exercise selection
- Suggest load adjustments based on readiness data
- Log or update notes when asked
- Be concise. Bullet points over paragraphs. No fluff.
- If readiness is red or yellow, proactively suggest adjustments.
- Respond in Icelandic if the user writes in Icelandic, English if in English.`;

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  // Return streaming response
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
