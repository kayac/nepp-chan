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
  results?: {
    file: string;
    chunks: number;
    error?: string;
    edited?: boolean;
  }[];
  editedCount?: number;
};

export type DeleteResult = {
  success: boolean;
  message: string;
  count?: number;
};

// ナレッジファイル関連
export type FileInfo = {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
  edited?: boolean;
};

export type FilesListResponse = {
  files: FileInfo[];
  truncated: boolean;
};

export type FileContentResponse = {
  key: string;
  content: string;
  contentType: string;
  size: number;
  lastModified: string;
};

export type SaveFileResponse = {
  success: boolean;
  message: string;
  chunks: number;
};

export type UploadFileResponse = {
  success: boolean;
  message: string;
  key: string;
  chunks: number;
};

export type ConvertFileResponse = {
  success: boolean;
  message: string;
  key: string;
  originalType: string;
  chunks: number;
};

// 統合ファイル情報
export type UnifiedFileInfo = {
  baseName: string;
  original?: {
    key: string;
    size: number;
    lastModified: string;
    contentType: string;
  };
  markdown?: {
    key: string;
    size: number;
    lastModified: string;
  };
  hasMarkdown: boolean;
};

export type UnifiedFilesListResponse = {
  files: UnifiedFileInfo[];
  truncated: boolean;
};

export type ReconvertFileResponse = {
  success: boolean;
  message: string;
  key: string;
  chunks: number;
};

// フィードバック関連
export type FeedbackRating = "good" | "bad";

export type FeedbackCategory =
  | "incorrect_fact"
  | "outdated_info"
  | "nonexistent_info"
  | "off_topic"
  | "other";

export type ConversationContextMessage = {
  id: string;
  role: string;
  content: string;
};

export type ConversationContext = {
  targetMessage: ConversationContextMessage;
  previousMessages: ConversationContextMessage[];
  nextMessages: ConversationContextMessage[];
};

export type ToolExecution = {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export type FeedbackSubmitRequest = {
  threadId: string;
  messageId: string;
  rating: FeedbackRating;
  category?: FeedbackCategory;
  comment?: string;
  conversationContext: ConversationContext;
  toolExecutions?: ToolExecution[];
};

export type FeedbackSubmitResponse = {
  success: boolean;
  id: string;
};

export type MessageFeedback = {
  id: string;
  threadId: string;
  messageId: string;
  rating: string;
  category: string | null;
  comment: string | null;
  conversationContext: string;
  toolExecutions: string | null;
  createdAt: string;
};

export type FeedbackStats = {
  total: number;
  good: number;
  bad: number;
  byCategory: Record<string, number>;
};

export type FeedbacksResponse = {
  feedbacks: MessageFeedback[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  stats: FeedbackStats;
};
