import { connection } from "next/server";
import { aiEnabled, generatePlan } from "@/lib/ai";
import { parsePlanRequest } from "@/lib/plan";
import { billingEnabled } from "@/lib/billing/config";
import { aiGate } from "@/lib/billing/gate";

/** Reports whether real AI is configured, so the UI can show "Claude" vs "Demo" mode. */
export async function GET() {
  await connection();
  return Response.json({ mode: aiEnabled() && billingEnabled() ? "claude" : "demo" });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parsePlanRequest(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  // Claude only for a signed-in user with an open AI session (free uses or a paid plan).
  const result = await generatePlan(parsed.value, await aiGate(request, body));
  return Response.json(result);
}
