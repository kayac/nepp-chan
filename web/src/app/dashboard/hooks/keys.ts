export const dashboardKeys = {
  analyticsPersona: (from?: string, to?: string) =>
    ["dashboard", "analytics", "persona", from, to] as const,
  analyticsConversations: (days: number) =>
    ["dashboard", "analytics", "conversations", days] as const,
  analyticsUsage: (weeks: number) =>
    ["dashboard", "analytics", "usage", weeks] as const,
  analyticsOntology: ["dashboard", "analytics", "ontology"] as const,
  weeklyReports: ["dashboard", "analytics", "reports"] as const,
  weeklyReportDetail: (id: string) =>
    ["dashboard", "analytics", "report", id] as const,
  broadcasts: ["dashboard", "broadcasts"] as const,
  broadcastDetail: (id: string) => ["dashboard", "broadcast", id] as const,
  personas: ["dashboard", "personas"] as const,
  emergencies: ["dashboard", "emergencies"] as const,
  feedbacks: ["dashboard", "feedbacks"] as const,
  feedbackDetail: (id: string) => ["dashboard", "feedback", id] as const,
  knowledgeFiles: ["dashboard", "knowledge", "files"] as const,
  knowledgeUnifiedFiles: ["dashboard", "knowledge", "unified"] as const,
  knowledgeFile: (key: string) =>
    ["dashboard", "knowledge", "file", key] as const,
  polls: ["dashboard", "polls"] as const,
  pollResults: (id: string) => ["dashboard", "poll", "results", id] as const,
  invitations: ["dashboard", "invitations"] as const,
};
