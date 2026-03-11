/**
 * lib/transformTickets.ts
 *
 * ── Data Transformation Layer ────────────────────────────────────────────────
 *
 * transformTickets() is the single source of truth for all metric computation.
 * It accepts the raw ticket array and builds BOTH queendom stats and per-agent
 * stats in ONE reduce pass — no repeated filter loops, no second DB fetch.
 *
 * Architecture
 * ─────────────────────────────────────────────────────────────────────────────
 *   Raw tickets (from Supabase)
 *         │
 *         ▼
 *   transformTickets()  ◄──  single reduce, O(n) pass
 *         │
 *         ├── queendoms.ananyshree  ◄──  TicketStats (6 metrics)
 *         ├── queendoms.anishqa    ◄──  TicketStats (6 metrics)
 *         └── agents               ◄──  Record<agentName, AgentBucket>
 *
 * Status contract (mirrors webhooks/freshdesk/route.ts — keep in sync)
 * ─────────────────────────────────────────────────────────────────────────────
 *   RESOLVED → "resolved" only
 *   PENDING  → open | pending | nudge client | nudge vendor |
 *              ongoing delivery | invoice due | closed
 *
 * Date contract
 * ─────────────────────────────────────────────────────────────────────────────
 *   All boundaries use IST (UTC+5:30) so "today" / "this month" match IST
 *   midnight on UTC servers (Vercel / Render).
 *   All metrics are anchored to created_at — "when was this ticket assigned?"
 */

// ── IST helpers ───────────────────────────────────────────────────────────────

const IST_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30 in milliseconds

export function istToday(): { day: string; month: string } {
  const now = new Date(Date.now() + IST_MS);
  const y  = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(now.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
}

/**
 * Convert a Supabase UTC timestamp to the IST calendar date "YYYY-MM-DD".
 *
 * Supabase returns TIMESTAMPTZ values as UTC strings. Naive slice(0,10) gives
 * the UTC date, which is wrong between 18:30 UTC (midnight IST) and 00:00 UTC
 * (05:30 IST). Adding IST_MS before reading UTC fields always gives the correct
 * IST calendar date.
 *
 * Falls back to prefix-slice for bare date strings or unparseable values.
 */
export function toISTDay(ts: string | null | undefined): string {
  if (!ts) return "";
  const utc = new Date(ts);
  if (isNaN(utc.getTime())) return ts.slice(0, 10);
  const ist = new Date(utc.getTime() + IST_MS);
  return [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
    String(ist.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// ── Status sets ───────────────────────────────────────────────────────────────

export const RESOLVED_STATUSES = new Set(["resolved"]);

export const PENDING_STATUSES = new Set([
  "open",
  "pending",
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
  "closed",
]);

export const isResolved = (s: string | null | undefined): boolean =>
  RESOLVED_STATUSES.has((s ?? "").toLowerCase().trim());

// ── Raw ticket shape ──────────────────────────────────────────────────────────

export interface RawTicket {
  ticket_id?:    string | number | null;
  status:        string | null;
  queendom_name: string | null;
  agent_name:    string | null;
  created_at:    string | null;
  resolved_at?:  string | null;
}

// ── Output shapes ─────────────────────────────────────────────────────────────

/**
 * Queendom-level ticket metrics.
 * Field names intentionally match the TicketStats interface in lib/types.ts.
 */
export interface QueendomBucket {
  totalThisMonth:    number; // all tickets created this month
  receivedToday:     number; // all tickets created today
  resolvedThisMonth: number; // tickets created this month, status = resolved
  solvedToday:       number; // tickets created today, status = resolved
  pendingToday:      number; // pending-status tickets created TODAY  ← DailyModal
  pendingToResolve:  number; // pending-status tickets created this month
  overdueCount:      number; // pending-status tickets created before today
}

/**
 * Per-agent metrics.
 * Field names intentionally match AgentLiveStats / AgentStats in the app.
 */
export interface AgentBucket {
  tasksAssignedToday:     number; // tickets created today (any status)
  tasksCompletedToday:    number; // tickets created today, status = resolved
  tasksCompletedThisMonth: number; // tickets created this month, status = resolved
  overdueCount:           number; // all non-resolved tickets (total pending)
}

export interface TransformedStats {
  queendoms: {
    ananyshree: QueendomBucket;
    anishqa:    QueendomBucket;
  };
  /**
   * Keyed by the exact agent_name value stored in Supabase.
   * Includes every agent that appears in at least one ticket.
   * Callers filter to roster agents via mergeAndRank().
   */
  agents: Record<string, AgentBucket>;
}

// ── Transformer ───────────────────────────────────────────────────────────────

export function transformTickets(tickets: RawTicket[]): TransformedStats {
  const { day: TODAY, month: THIS_MONTH } = istToday();

  const emptyQueendom = (): QueendomBucket => ({
    totalThisMonth:    0,
    receivedToday:     0,
    resolvedThisMonth: 0,
    solvedToday:       0,
    pendingToday:      0,
    pendingToResolve:  0,
    overdueCount:      0,
  });

  const emptyAgent = (): AgentBucket => ({
    tasksAssignedToday:      0,
    tasksCompletedToday:     0,
    tasksCompletedThisMonth: 0,
    overdueCount:            0,
  });

  return tickets.reduce<TransformedStats>(
    (acc, ticket) => {
      const status    = (ticket.status        ?? "").toLowerCase().trim();
      const queueName = (ticket.queendom_name  ?? "").toLowerCase().trim();
      const agentName = (ticket.agent_name     ?? "").trim();

      // All date logic anchored to created_at (IST)
      const createdDay   = toISTDay(ticket.created_at);
      const createdMonth = createdDay.slice(0, 7); // "YYYY-MM" from "YYYY-MM-DD"

      const res         = isResolved(status);
      const pending     = !res && status !== "";
      const isToday     = createdDay    === TODAY;
      const isThisMonth = createdMonth  === THIS_MONTH;
      const isOverdue   = pending && createdDay !== "" && createdDay < TODAY;

      // ── Queendom bucket ──────────────────────────────────────────────────────
      const qKey =
        queueName.includes("ananyshree") ? "ananyshree" :
        queueName.includes("anishqa")    ? "anishqa"    : null;

      if (qKey) {
        const q = acc.queendoms[qKey];
        if (isThisMonth) q.totalThisMonth++;
        if (isToday)     q.receivedToday++;
        if (res && isThisMonth) q.resolvedThisMonth++;
        if (res && isToday)     q.solvedToday++;
        if (pending && isToday)      q.pendingToday++;
        if (pending && isThisMonth)  q.pendingToResolve++;
        if (isOverdue) q.overdueCount++;
      }

      // ── Agent bucket ─────────────────────────────────────────────────────────
      if (agentName) {
        if (!acc.agents[agentName]) acc.agents[agentName] = emptyAgent();
        const a = acc.agents[agentName];
        if (isToday)            a.tasksAssignedToday++;
        if (isToday  && res)    a.tasksCompletedToday++;
        if (isThisMonth && res) a.tasksCompletedThisMonth++;
        if (pending)            a.overdueCount++;
      }

      return acc;
    },
    {
      queendoms: { ananyshree: emptyQueendom(), anishqa: emptyQueendom() },
      agents: {},
    },
  );
}
