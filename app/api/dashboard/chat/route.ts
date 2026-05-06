import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

const tools: Anthropic.Tool[] = [
  {
    name: "log_note",
    description:
      "Log a note to today's session scratch pad. Use when the user asks you to log, record, or note something about the session (sets, reps, weights, how something felt, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        note: { type: "string", description: "The note text to log" },
      },
      required: ["note"],
    },
  },
  {
    name: "mark_session_done",
    description:
      "Mark today's training session as completed. Use only when the user explicitly says they are done with training.",
    input_schema: {
      type: "object" as const,
      properties: {
        notes: {
          type: "string",
          description: "Optional completion notes (how it went, RPE, etc.)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_health_history",
    description:
      "Fetch the user's health metrics (HRV, sleep, RHR) for the past N days. Use when asked about trends.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default 7, max 30)",
        },
      },
      required: [],
    },
  },
];

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  sb: ReturnType<typeof createServerClient>,
  today: string
): Promise<unknown> {
  if (name === "log_note") {
    const note = input.note as string;
    const time = new Date().toLocaleTimeString("is-IS", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const existing = await sb
      .from("session_scratch")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .eq("scratch_date", today)
      .eq("scratch_status", "active")
      .maybeSingle();

    const entry = { time, note: note.trim() };
    if (existing.data) {
      const entries = [...(existing.data.entries || []), entry];
      await sb
        .from("session_scratch")
        .update({ entries, last_updated: new Date().toISOString() })
        .eq("id", existing.data.id);
    } else {
      const sessionRes = await sb
        .from("next_session")
        .select("session_label")
        .eq("athlete_id", ATHLETE_ID)
        .maybeSingle();
      const label = sessionRes.data?.session_label || "Session";
      await sb.from("session_scratch").insert({
        athlete_id: ATHLETE_ID,
        scratch_date: today,
        session_label: label,
        entries: [entry],
        started_at: new Date().toISOString(),
        scratch_status: "active",
      });
    }
    return { ok: true, message: `Logged: "${note}"` };
  }

  if (name === "mark_session_done") {
    const notes = (input.notes as string) || "";
    await sb
      .from("sessions")
      .update({ status: "completed" })
      .eq("athlete_id", ATHLETE_ID)
      .eq("scheduled_date", today);

    const weekRes = await sb
      .from("weekly_state")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .order("week_start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (weekRes.data) {
      await sb
        .from("weekly_state")
        .update({
          sessions_completed: (weekRes.data.sessions_completed || 0) + 1,
        })
        .eq("id", weekRes.data.id);
    }

    if (notes.trim()) {
      const time = new Date().toLocaleTimeString("is-IS", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const existing = await sb
        .from("session_scratch")
        .select("*")
        .eq("athlete_id", ATHLETE_ID)
        .eq("scratch_date", today)
        .eq("scratch_status", "active")
        .maybeSingle();
      if (existing.data) {
        const entries = [
          ...(existing.data.entries || []),
          { time, note: `[Lokið] ${notes}` },
        ];
        await sb
          .from("session_scratch")
          .update({ entries, scratch_status: "processed" })
          .eq("id", existing.data.id);
      }
    }
    return { ok: true, message: "Session marked as completed" };
  }

  if (name === "get_health_history") {
    const days = Math.min(30, (input.days as number) || 7);
    const from = new Date();
    from.setDate(from.getDate() - days);
    const { data } = await sb
      .from("health_metrics")
      .select(
        "metric_date,readiness_call,hrv_sdnn,sleep_total_h,resting_hr,ultrahuman_score"
      )
      .eq("athlete_id", ATHLETE_ID)
      .gte("metric_date", from.toISOString().split("T")[0])
      .order("metric_date");
    return { data: data || [] };
  }

  return { error: "Unknown tool" };
}

export async function POST(req: NextRequest) {
  const { message, context } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const [sessionRes, weekRes, healthRes, blockRes] = await Promise.all([
    sb
      .from("next_session")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .maybeSingle(),
    sb
      .from("sessions")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .order("scheduled_date")
      .limit(7),
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
  ]);

  let health = healthRes.data;
  if (!health) {
    const fallback = await sb
      .from("health_metrics")
      .select("*")
      .eq("athlete_id", ATHLETE_ID)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    health = fallback.data;
  }

  const session = sessionRes.data;
  const weekSessions = weekRes.data || [];
  const block = blockRes.data;

  const systemPrompt = `You are 360 Heilsa Coach — Rafn Franklin's personal AI fitness coach. You are direct, knowledgeable, and opinionated. You adapt training based on recovery data and push back when needed.

Current date: ${today}

CURRENT SESSION:
${
  session
    ? `- Label: ${session.session_label}
- Type: ${session.session_type}
- Date: ${session.planned_date}
- Metadata: ${JSON.stringify(session.metadata)}
- Plan:
${session.content_md}`
    : "No session data available."
}

THIS WEEK'S SESSIONS:
${weekSessions.map((s: any) => `- ${s.scheduled_date} ${s.session_type}: ${s.label} (${s.status})`).join("\n")}

TODAY'S READINESS:
${
  health
    ? `- Readiness: ${health.readiness_call}
- Sleep: ${health.sleep_total_h ?? "—"}h
- HRV: ${health.hrv_sdnn ?? "—"}ms
- Resting HR: ${health.resting_hr ?? "—"}bpm
- Ultrahuman: ${health.ultrahuman_score ?? "—"}
- Notes: ${health.notes || "none"}`
    : "No readiness data for today. Ask Rafn for subjective readiness."
}

CURRENT BLOCK:
${
  block
    ? `- Name: ${block.name}
- Started: ${block.started_at}
- Planned weeks: ${block.planned_weeks}
- Deload due: ${block.deload_due}`
    : "No active block."
}

${context ? `ADDITIONAL CONTEXT FROM USER:\n${context}` : ""}

Your role:
- Answer questions about today's session, the plan, exercise selection
- Suggest load adjustments based on readiness data
- Use tools to log notes or mark sessions done when asked — do it, don't just describe it
- Be concise. Bullet points over paragraphs. No fluff.
- If readiness is red or yellow, proactively suggest adjustments.
- Respond in Icelandic if the user writes in Icelandic, English if in English.`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const messages: Anthropic.MessageParam[] = [
          { role: "user", content: message },
        ];

        // Stream first response (may include tool calls)
        const firstStream = client.messages.stream({
          model: "claude-opus-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          tools,
          messages,
        });

        const toolUseBlocks: Array<{
          id: string;
          name: string;
          inputStr: string;
        }> = [];
        let currentTool: { id: string; name: string; inputStr: string } | null =
          null;

        for await (const chunk of firstStream) {
          if (
            chunk.type === "content_block_start" &&
            chunk.content_block.type === "tool_use"
          ) {
            currentTool = {
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              inputStr: "",
            };
          } else if (chunk.type === "content_block_delta") {
            if (chunk.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(chunk.delta.text));
            } else if (
              chunk.delta.type === "input_json_delta" &&
              currentTool
            ) {
              currentTool.inputStr += chunk.delta.partial_json;
            }
          } else if (chunk.type === "content_block_stop" && currentTool) {
            toolUseBlocks.push({ ...currentTool });
            currentTool = null;
          }
        }

        // No tool calls — done
        if (toolUseBlocks.length === 0) {
          controller.close();
          return;
        }

        // Execute tools
        const parsedTools = toolUseBlocks.map((t) => ({
          ...t,
          input: JSON.parse(t.inputStr || "{}"),
        }));
        const toolResults = await Promise.all(
          parsedTools.map(async (t) => ({
            type: "tool_result" as const,
            tool_use_id: t.id,
            content: JSON.stringify(await executeTool(t.name, t.input, sb, today)),
          }))
        );

        const finalMessage = await firstStream.finalMessage();

        // Stream final response after tool results
        const finalStream = client.messages.stream({
          model: "claude-opus-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          tools,
          messages: [
            ...messages,
            { role: "assistant", content: finalMessage.content },
            { role: "user", content: toolResults },
          ],
        });

        for await (const chunk of finalStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        controller.close();
      } catch {
        controller.enqueue(encoder.encode("Villa. Reyndu aftur."));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
