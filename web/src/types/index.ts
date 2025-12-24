import type { UIMessage } from "ai";

export type Thread = {
  id: string;
  resourceId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
};

export type ThreadsResponse = {
  threads: Thread[];
  hasMore: boolean;
  total: number;
  page: number;
  perPage: number;
};

export type MessagesResponse = {
  messages: UIMessage[];
};

export type Persona = {
  id: string;
  resourceId: string;
  category: string;
  tags: string | null;
  content: string;
  source: string | null;
  topic: string | null;
  sentiment: string | null;
  demographicSummary: string | null;
  createdAt: string;
  updatedAt: string | null;
  conversationEndedAt: string | null;
};

export type PersonasResponse = {
  personas: Persona[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type EmergencyReport = {
  id: string;
  type: string;
  description: string | null;
  location: string | null;
  reportedAt: string;
  updatedAt: string | null;
};

export type EmergenciesResponse = {
  emergencies: EmergencyReport[];
  total: number;
};

export type SyncResult = {
  success: boolean;
  message: string;
  results?: { file: string; chunks: number; error?: string }[];
};

export type DeleteResult = {
  success: boolean;
  message: string;
  count?: number;
};
