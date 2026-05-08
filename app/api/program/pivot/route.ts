/**
 * POST /api/program/pivot
 * Streaming conversation where Franklin helps the athlete clarify a goal change.
 * Ends with [PIVOT_READY]{"new_goal":"...","context":"..."}[/PIVOT_READY]
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;
const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { messages, message } = await req.json() as {
    messages: { role: string; content: string }[];
    message: string;
  };

  const sb = createServerClient();
  const { data: athlete } = await sb
    .from("athletes")
    .select("full_name, goals, training_schedule")
    .eq("id", ATHLETE_ID)
    .single();

  const schedule = athlete?.training_schedule as { days?: { day: string; type: string }[] } | null;
  const scheduleStr = schedule?.days?.map(d => `${d.day}: ${d.type}`).join(", ") || "Not set";

  const system = `You are Coach Franklin — a military veteran turned elite performance coach. You are having a goal-change conversation with ${athlete?.full_name || "your athlete"}.

## CURRENT SITUATION
Current goal: ${athlete?.goals || "Not specified"}
Current schedule: ${scheduleStr}

## YOUR MISSION
The athlete wants to change direction. Find out:
1. What specifically they want to change — is it the goal, the sport focus, the training style, or the intensity?
2. Why now — what triggered this? Life event, hitting a plateau, loss of motivation, new opportunity?
3. Any constraints — injuries, schedule changes, equipment, time?
4. Timeline — is there an event or deadline driving this?

Ask one or two focused questions. Don't interrogate. Be genuinely curious — this matters.

When you understand the new direction clearly enough to build a program around it, end with:
[PIVOT_READY]{"new_goal":"one line description of new goal","context":"2-3 sentences of what changed and why, what constraints matter"}[/PIVOT_READY]

Keep responses under 100 words unless writing the summary. Don't output [PIVOT_READY] until you genuinely understand the new direction.`;

  const history = (messages || []).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const allMessages = message
    ? [...history, { role: "user" as const, content: message }]
    : history.length === 0
      ? [{ role: "user" as const, content: "__OPEN__" }]
      : history;

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 350,
    system,
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

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
