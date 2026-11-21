import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GOALS, LEVELS, WEEKDAYS, generateDemoPlan, isWeeklyPlanShape, type PlanRequest, type WeeklyPlan } from "./plan";

export const MODEL = "claude-sonnet-5-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "days", "tips"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "focus", "rest", "exercises"],
        properties: {
          day: { type: "string", enum: WEEKDAYS },
          focus: { type: "string" },
          rest: { type: "boolean" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "sets", "reps"],
              properties: {
                name: { type: "string" },
                sets: { type: "integer" },
                reps: { type: "string" },
                trackable: { type: "string", enum: ["squat", "pushup", "curl"] },
              },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are an encouraging, safety-conscious certified personal trainer inside the "AI Fitness Coach" app.
Write a 7-day home-workout plan (Monday to Sunday, exactly 7 entries, rest days have an empty exercises list).
The app can count reps with the camera for three moves; whenever you prescribe one of them, set "trackable" to "squat", "pushup" or "curl". Prefer bodyweight or dumbbell moves.
Keep "title" under 60 characters, "summary" to two sentences, and give 3–5 short practical tips. Respond with the JSON object only.`;

export interface PlanResult {
  plan: WeeklyPlan;
  mode: "claude" | "demo";
  warning?: string;
}

/** Generate a weekly plan with Claude, falling back to the rule-based demo plan without a key or on failure. */
export async function generatePlan(req: PlanRequest): Promise<PlanResult> {
  if (!aiEnabled()) return { plan: generateDemoPlan(req), mode: "demo" };

  const client = new Anthropic();
  const user = [
    `Goal: ${GOALS[req.goal]}`,
    `Experience: ${LEVELS[req.level]}`,
    `Training days per week: ${req.daysPerWeek}`,
    `Minutes per session: ${req.minutesPerSession}`,
    req.notes ? `Notes from the user (preferences, equipment, injuries): ${req.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: PLAN_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      return { plan: generateDemoPlan(req), mode: "demo", warning: "The AI declined this request; showing a template plan." };
    }
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed: unknown = JSON.parse(text);
    if (!isWeeklyPlanShape(parsed)) throw new Error("Model returned an unexpected plan shape");
    return {
      plan: { ...parsed, source: "claude", createdAt: new Date().toISOString() },
      mode: "claude",
    };
  } catch (err) {
    let reason = "AI request failed";
    if (err instanceof Anthropic.AuthenticationError) reason = "Invalid ANTHROPIC_API_KEY";
    else if (err instanceof Anthropic.RateLimitError) reason = "AI rate limit reached";
    else if (err instanceof Anthropic.APIError) reason = `AI error ${err.status ?? ""}`.trim();
    else if (err instanceof SyntaxError) reason = "AI returned invalid JSON";
    console.error("[plan] falling back to demo plan:", err);
    return { plan: generateDemoPlan(req), mode: "demo", warning: `${reason}; showing a template plan.` };
  }
}
