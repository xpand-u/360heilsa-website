/**
 * POST /api/dashboard/movement-analysis
 * Analyses extracted video frames from a movement test.
 * Accepts: { test: string, frames: string[] } where frames are base64 data URLs.
 * Returns: { analysis: string, score: string, flags: string[] }
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const client = new Anthropic();

const TEST_CRITERIA: Record<string, string> = {
  overhead_squat: `
You are analysing an overhead squat movement test. The athlete filmed themselves from the side or front.

Look for:
- Depth: does the hip crease drop below the knee?
- Torso: stays vertical or excessive forward lean?
- Knees: track over toes or cave inward (valgus)?
- Heels: stay flat or rise?
- Arms: stay vertical overhead or drop forward?
- Lower back: neutral or rounds/overextends?

Rate overall quality: Good / Moderate / Poor
Flag any compensations you see clearly in the frames.
Be direct. Don't flag things you can't actually see. If image quality is too low to assess, say so.`,

  default: `
You are analysing a movement quality test from extracted video frames.
Assess what you can see about the movement pattern quality.
Note any obvious compensations, asymmetries, or range of motion limitations.
Be direct. Only flag what is clearly visible. If image quality prevents assessment, say so.`,
};

export async function POST(req: NextRequest) {
  const { test, frames } = await req.json() as { test: string; frames: string[] };

  if (!frames?.length) {
    return NextResponse.json({ error: "No frames provided" }, { status: 400 });
  }

  const criteria = TEST_CRITERIA[test] || TEST_CRITERIA.default;

  // Build image content blocks from base64 frames
  const imageContent: Anthropic.ImageBlockParam[] = frames
    .slice(0, 4) // max 4 frames
    .map(frame => {
      // frame is a data URL: "data:image/jpeg;base64,..."
      const match = frame.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) return null;
      const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      const data = match[2];
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data },
      };
    })
    .filter(Boolean) as Anthropic.ImageBlockParam[];

  if (!imageContent.length) {
    return NextResponse.json({ error: "Could not parse frames" }, { status: 400 });
  }

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          ...imageContent,
          {
            type: "text",
            text: `${criteria}\n\nRespond in this exact JSON format:
{
  "score": "Good" | "Moderate" | "Poor" | "Cannot assess",
  "summary": "2-3 sentence summary of what you saw",
  "flags": ["flag1", "flag2"]
}

Only include flags you can clearly see. Return valid JSON only.`,
          },
        ],
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON from response
  let parsed: { score: string; summary: string; flags: string[] } | null = null;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // fall through
  }

  if (!parsed) {
    // Return raw text as summary if JSON parsing failed
    return NextResponse.json({
      score: "Cannot assess",
      summary: raw.slice(0, 300),
      flags: [],
    });
  }

  return NextResponse.json(parsed);
}
