import { connection } from "next/server";
import { aiEnabled, MODEL } from "@/lib/ai";
import { billingEnabled } from "@/lib/billing/config";

/** Claude runs only when payments are configured, so every AI call belongs to a signed-in user's plan. */
export async function GET() {
  await connection();
  const billing = billingEnabled();
  const ai = aiEnabled() && billing;
  return Response.json({ mode: ai ? "claude" : "demo", model: MODEL, ai, billing });
}
