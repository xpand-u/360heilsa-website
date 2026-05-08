/**
 * POST /api/dashboard/assess/screen
 * Accepts up to 4 postural photos (base64) + optional self-reported findings.
 * Streams a structured assessment report from Claude Opus.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const maxDuration = 120;

const client = new Anthropic();
const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

const PROTOCOL_SUMMARY = `
## Postural Analysis Framework (CHEK/Janda/FMS/NASM/DNS)

### Phase 1 — Static Posture (from photos)
Lateral views — plumb line: ear → shoulder → hip → knee → ankle
- Lumbar curve: normal S-curve vs flat vs hyperlordotic
- Thoracic curve: normal vs rounded vs flat
- Cervical curve and head position (ear forward of shoulder = forward head posture)
- Pelvic angle: anterior tilt vs posterior tilt vs neutral
- Knee position: hyperextended vs slightly flexed

Anterior/posterior views:
- Shoulder height asymmetry (left vs right)
- Head tilt or shift
- ASIS level (one higher = pelvic tilt or leg length discrepancy)
- Knee alignment (valgus vs varus vs neutral)
- Foot turn-out angle (asymmetry = hip rotation bias)
- Scapular position from posterior: winging, asymmetry, height

### Key Pattern Identifications
- **Upper Crossed Syndrome (Janda):** Tight upper traps/levator scapulae + tight pecs → weak deep neck flexors + weak lower/mid traps. Presents as forward head, rounded shoulders, protracted scapulae.
- **Lower Crossed Syndrome (Janda):** Tight hip flexors + tight lumbar extensors → weak glutes + weak deep abdominals. Presents as anterior pelvic tilt, hyperlordosis, forward lean.
- **Sway Back Posture:** Hips anterior to plumb line, upper body leaning back. Lumbar flexion not lordosis.
- **Flat Back:** Reduced lumbar and thoracic curves. Posterior pelvic tilt.
- **Mixed patterns:** Most real athletes show elements of multiple patterns.

### Programming Implications of Common Findings
- Forward head / upper crossed: Prioritise deep neck flexors, lower trap, serratus; reduce upper trap loading; thoracic extension work
- Anterior pelvic tilt / lower crossed: Prioritise glute activation, hip flexor stretching, core bracing patterns; monitor lumbar loading
- Scapular winging / asymmetry: Single-arm work to address dominant side; serratus activation; review pressing setup
- Shoulder height asymmetry: Assess QL and lateral line; note in pressing and overhead work
- Right shoulder: Given existing anterior shoulder issue, pay particular attention to right shoulder position, scapular rest position, and any asymmetry vs left
`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { photos, manualFindings } = body as {
    photos: Record<string, string>;
    manualFindings?: string;
  };

  // Read athlete profile from DB — never hardcode
  const sb = createServerClient();
  const { data: athlete } = await sb
    .from("athletes")
    .select("full_name, goals, training_age_years, gym, coach_notes, goals_structured, onboarding_data")
    .eq("id", ATHLETE_ID)
    .single();

  const athleteName = athlete?.full_name || "Athlete";
  const goals = athlete?.goals || athlete?.goals_structured?.goals || "General performance";
  const trainingAge = athlete?.training_age_years || athlete?.goals_structured?.training_age_years || "Unknown";
  const gym = athlete?.gym || athlete?.goals_structured?.gym || "Unknown";
  const notes = athlete?.coach_notes || "";

  const ATHLETE_PROFILE = `
Name: ${athleteName}
Goals: ${goals}
Training age: ${trainingAge} years
Training environment: ${gym}
${notes ? `Coach notes: ${notes}` : ""}`.trim();

  // Inject real date server-side — never let the model guess
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const VIEW_LABELS: Record<string, string> = {
    right_lateral: "View 1 — Right lateral (right side facing camera)",
    left_lateral:  "View 2 — Left lateral (left side facing camera)",
    anterior:      "View 3 — Anterior (front view, facing camera)",
    posterior:     "View 4 — Posterior (rear view, back to camera)",
  };

  const userContent: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: "Here are the postural assessment photos. Please analyze and generate the screening report.",
    },
  ];

  let photoCount = 0;
  for (const [key, label] of Object.entries(VIEW_LABELS)) {
    if (photos[key]) {
      userContent.push({ type: "text", text: `\n**${label}:**` } as any);
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: photos[key] },
      } as any);
      photoCount++;
    }
  }

  if (manualFindings?.trim()) {
    userContent.push({
      type: "text",
      text: `\n---\n**Self-reported mobility / activation / movement test findings:**\n${manualFindings}`,
    } as any);
  }

  if (photoCount === 0 && !manualFindings?.trim()) {
    return new Response("No photos or findings provided", { status: 400 });
  }

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    system: `You are Coach Franklin — a military veteran turned elite performance coach with deep expertise in CHEK Institute methodology, Janda's muscle imbalance syndromes, FMS, NASM, and DNS/Prague School.

Today's date: ${today}. Use this exact date. Never guess or approximate the date.

## ATHLETE
${ATHLETE_PROFILE}

## ASSESSMENT FRAMEWORK
${PROTOCOL_SUMMARY}

## REPORT STRUCTURE

Write the report in exactly this order. Do not add sections. Do not remove sections.

---

# Postural Screening — ${athleteName}
*${today}*

## Coach Franklin's Assessment
[4–5 sentences. Plain language. Speak directly to ${athleteName} as their coach — use "you" and "your". Tell them what you see, what pattern you're looking at, and what it means for their body and training. Sound like someone who has genuinely looked at them and has a clear point of view. No jargon. No hedging.]

## What We're Implementing
[Exactly 3 items. Frame each one as a coaching decision you are making together — not a to-do list, but a program design choice. Use language like "I'm building X into your warmups", "We're swapping Y for Z until...", "I want you doing A on your lifting days because...". Each item should name the specific exercise or change, when/where it fits in the current schedule, and one sentence on why it addresses the finding. Write like a coach briefing his athlete before a training block, not like a physio writing discharge notes.]

## How This Shapes Your Programming
[3–4 sentences. The bigger picture. How do these postural findings affect how I'm going to design your training going forward — not just this week, but the next block? What will I be prioritising, what will I be cautious about, and what is the connection between fixing these patterns and hitting your actual goals (the running, the shoulder, the BJJ).]

## 6-Week Goal
[One sentence. Specific and measurable. What should be visibly different at the next screening if the work is done.]

---

## Clinical Detail

### Static Postural Analysis
[Full landmark-by-landmark analysis of each view. Be specific — exact deviations, estimated degrees, asymmetries. This is for a CHEK-trained 16-year veteran. Technical language is appropriate here.]

#### Lateral Views
#### Anterior View
#### Posterior View

### Pattern Identification
[Name the dominant pattern(s) with severity. Table format is fine.]

### Key Findings (Priority Order)
[Top 5–7 findings. Each with clinical context and mechanism.]

### Programming Implications
[Specific impact on current training. What to modify, avoid, prioritise. Reference right shoulder directly.]

### Priority Corrections
[Ordered intervention list.]

### 6-Week Re-assessment Markers
[What to re-test at next screening to track progress.]`,

    messages: [{ role: "user", content: userContent }],
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
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
