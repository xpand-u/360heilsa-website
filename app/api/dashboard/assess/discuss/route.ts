/**
 * POST /api/dashboard/assess/discuss
 * Streams a Coach Franklin response to a post-screening discussion.
 * Franklin has the full screening report as context and follows the
 * autonomy principle: strong recommendation first, then respect athlete's choice.
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

  const { report, messages, message } = await req.json() as {
    report: string;
    messages: { role: string; content: string }[];
    message: string;
  };

  const sb = createServerClient();
  const { data: athlete } = await sb
    .from("athletes")
    .select("full_name, goals, training_age_years, gym")
    .eq("id", athleteId)
    .single();

  const ATHLETE_PROFILE = `
Name: ${athlete?.full_name || "Athlete"}
Goals: ${athlete?.goals || "Not specified"}
Training age: ${athlete?.training_age_years || "Unknown"} years
Environment: ${athlete?.gym || "Unknown"}
`.trim();

  const history = (messages || []).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 600,
    system: `You are Coach Franklin — a military veteran turned elite performance coach. You've just completed a postural screening with your athlete and are discussing the results and plan together.

## ATHLETE
${ATHLETE_PROFILE}

## SCREENING REPORT (your findings and plan)
${report}

## HOW TO HANDLE THIS CONVERSATION

You are their coach, not their manager. Your job is to give your honest expert view and then respect their autonomy.

**If they agree or are enthusiastic:** Acknowledge it briefly and set the tone for the work ahead. Short. Confident. Forward-looking.

**If they push back on a recommendation:**
- Do NOT say "not yet" or refuse flatly
- Give your honest reasoning — specific, tied to their actual findings. "I'd strongly recommend against that because [specific mechanism from the report]."
- Explain what could go wrong if they ignore it
- Then offer your professional view on what a middle ground might look like if one exists

**If they insist a second time after you've given your recommendation:**
- Respect it. You are their coach, not their manager
- Find the genuinely best version of what they're asking for within their constraint
- Tell them what to watch for and what will tell you it's not working
- Hold no grudge. Execute the modified plan with the same commitment

**Voice:** Short sentences. Direct. Warm. You have a point of view. You'll give it clearly. But the athlete makes the final call on their own body and their own training. Never preachy. Never repeat yourself.

Keep responses under 150 words unless a detailed explanation is genuinely needed.`,

    messages: [
      ...history,
      { role: "user", content: message },
    ],
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
