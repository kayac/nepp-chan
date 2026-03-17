import type { paths } from "./api";

// パスベース型抽出ヘルパー
type GetOk<P extends keyof paths> = paths[P] extends {
  get: { responses: { 200: { content: { "application/json": infer R } } } };
}
  ? R
  : never;

type PostCreated<P extends keyof paths> = paths[P] extends {
  post: { responses: { 201: { content: { "application/json": infer R } } } };
}
  ? R
  : never;

type PostOk<P extends keyof paths> = paths[P] extends {
  post: { responses: { 200: { content: { "application/json": infer R } } } };
}
  ? R
  : never;

type PostBody<P extends keyof paths> = paths[P] extends {
  post: {
    requestBody?: { content: { "application/json": infer B } };
  };
}
  ? B
  : never;

type PutOk<P extends keyof paths> = paths[P] extends {
  put: { responses: { 200: { content: { "application/json": infer R } } } };
}
  ? R
  : never;

type DeleteOk<P extends keyof paths> = paths[P] extends {
  delete: {
    responses: { 200: { content: { "application/json": infer R } } };
  };
}
  ? R
  : never;

type PutBody<P extends keyof paths> = paths[P] extends {
  put: {
    requestBody?: { content: { "application/json": infer B } };
  };
}
  ? B
  : never;

// スレッド
export type ThreadsResponse = GetOk<"/threads">;
export type Thread = ThreadsResponse["threads"][number];
export type MessagesResponse = GetOk<"/threads/{threadId}/messages">;

// 配信
export type BroadcastsResponse = GetOk<"/admin/broadcast">;
export type BroadcastMessage = BroadcastsResponse["broadcasts"][number];
export type BroadcastStatus = "draft" | "scheduled" | "sent" | "failed";
export type CreateBroadcastRequest = PostBody<"/admin/broadcast">;
export type UpdateBroadcastRequest = PutBody<"/admin/broadcast/{id}">;

// フィードバック
export type FeedbacksResponse = GetOk<"/admin/feedback">;
export type MessageFeedback = FeedbacksResponse["feedbacks"][number];
export type FeedbackStats = FeedbacksResponse["stats"];
export type FeedbackSubmitRequest = PostBody<"/feedback">;
export type FeedbackSubmitResponse = PostCreated<"/feedback">;
export type FeedbackRating = "good" | "bad" | "idea";
export type FeedbackCategory =
  | "incorrect_fact"
  | "outdated_info"
  | "nonexistent_info"
  | "off_topic"
  | "other";

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  incorrect_fact: "事実と異なる",
  outdated_info: "情報が古い",
  nonexistent_info: "存在しない情報",
  off_topic: "質問に答えていない",
  other: "その他",
};

export type ConversationContext = MessageFeedback["conversationContext"];
export type ConversationContextMessage = ConversationContext["targetMessage"];
export type ToolExecution = NonNullable<
  MessageFeedback["toolExecutions"]
>[number];

// 緊急情報
export type EmergenciesResponse = GetOk<"/admin/emergency">;
export type EmergencyReport = EmergenciesResponse["emergencies"][number];

// ペルソナ
export type PersonasResponse = GetOk<"/admin/persona">;
export type Persona = PersonasResponse["personas"][number];

// ナレッジ
export type SyncResult = PostOk<"/admin/knowledge/sync">;
export type DeleteResult = DeleteOk<"/admin/knowledge">;
export type FilesListResponse = GetOk<"/admin/knowledge/files">;
export type FileInfo = FilesListResponse["files"][number];
export type FileContentResponse = GetOk<"/admin/knowledge/files/{key}">;
export type SaveFileResponse = PutOk<"/admin/knowledge/files/{key}">;
export type UnifiedFilesListResponse = GetOk<"/admin/knowledge/unified">;
export type UnifiedFileInfo = UnifiedFilesListResponse["files"][number];

// multipart レスポンス型（raw fetch で使用）
export type ReconvertFileResponse = PostOk<"/admin/knowledge/reconvert">;

// 招待
export type InvitationsResponse = GetOk<"/admin/invitations">;
export type Invitation = InvitationsResponse["invitations"][number];
export type CreateInvitationResponse = PostCreated<"/admin/invitations">;
