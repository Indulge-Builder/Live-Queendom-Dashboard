export interface MemberStats {
  total: number;
}

export interface TicketStats {
  totalThisMonth:    number; // all tickets created within this calendar month
  receivedToday:     number; // all tickets created today (any status)
  resolvedThisMonth: number; // tickets created this month, status = resolved
  solvedToday:       number; // tickets created today, status = resolved
  pendingToday:      number; // pending-status tickets created TODAY  ← DailyModal
  pendingToResolve:  number; // pending-status tickets created this month
  overdueCount:      number; // pending-status tickets created BEFORE today (backlog)
}

export interface AgentStats {
  id: string;
  name: string;
  queendom: "ananyshree" | "anishqa";
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
  overdueCount: number;      // all non-resolved tickets assigned to this agent (pending count)
}

export interface QueenStats {
  members: MemberStats;
  tickets: TicketStats;
  agents: AgentStats[];
}

