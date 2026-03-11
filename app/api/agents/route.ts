/**
 * GET /api/agents
 *
 * Returns per-agent stats grouped by queendom.
 * All computation is delegated to transformTickets() in lib/transformTickets.ts.
 *
 * Prefer /api/dashboard when you need both queendom and agent data — it runs
 * a single Supabase query instead of two.
 *
 * Response: { ananyshree: Record<name, AgentBucket>, anishqa: Record<name, AgentBucket> }
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { transformTickets, type RawTicket } from "@/lib/transformTickets";
import { ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "@/lib/agentRoster";

export async function GET() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceKey || serviceKey === "paste_your_service_role_key_here") {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db
    .from("tickets")
    .select("status, queendom_name, agent_name, created_at, resolved_at");

  if (error) {
    console.error("[/api/agents] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { agents } = transformTickets(data as RawTicket[]);

  // Filter the flat agent map down to roster members only, grouped by queendom.
  // Case-insensitive lookup so minor name-casing differences don't break the match.
  const agentsCI: Record<string, typeof agents[string]> = {};
  for (const [name, stats] of Object.entries(agents)) {
    agentsCI[name.toLowerCase()] = stats;
  }

  const pick = (roster: string[]) =>
    Object.fromEntries(
      roster.map((name) => [name, agentsCI[name.toLowerCase()] ?? {
        tasksAssignedToday: 0,
        tasksCompletedToday: 0,
        tasksCompletedThisMonth: 0,
        overdueCount: 0,
      }]),
    );

  return NextResponse.json(
    { ananyshree: pick(ROSTER_ANANYSHREE), anishqa: pick(ROSTER_ANISHQA) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
