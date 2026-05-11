/**
 * POST /api/onboarding/schedule-suggest
 * Uses Claude to generate a personalized weekly schedule recommendation
 * based on the athlete's intake data.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";

export const maxDuration = 30;

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { intakeData } = await req.json();

  const prompt = `Based on the athlete's intake data (goals, life context, training age, intensity response, injuries, sports), recommend the optimal weekly training schedule. Return ONLY a JSON object in this exact format — no markdown, no explanation outside the JSON:
{"days":[{"day":"mon","type":"lifting","time":"morning","duration":75},...],"reasoning":"..."}

Rules:
- "day" values must be exactly (lowercase): mon, tue, wed, thu, fri, sat, sun
- "type" values must be from: lifting, conditioning, mobility, run, rest
- "time" values must be from: morning, afternoon, evening
- "duration" is session length in minutes — pick from: 30, 45, 60, 75, 90. Base it on session type and what you know about this athlete's schedule and lifestyle. Lifting typically 60-75, runs 30-60, BJJ 90, conditioning 45-60.
- "reasoning" is 2-3 sentences in Franklin's voice: direct, no fluff, no em dashes. Explain why this structure works for this specific person.
- Only include training days (not rest days) in the days array, unless rest days need specific scheduling notes.

Athlete intake data:
${JSON.stringify(intakeData, null, 2)}`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: { days: { day: string; type: string; time: string }[]; reasoning: string };
  try {
    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Failed to parse schedule suggestion" }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
