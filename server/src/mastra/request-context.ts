import type { D1Store } from "@mastra/cloudflare-d1";
import { RequestContext } from "@mastra/core/request-context";

import type { AuthUser } from "~/schemas/auth-schema";
import type {
  VoiceFindingsSlot,
  VoicePrefetchSlot,
} from "~/services/voice/findings-slot";

export type MastraRequestContextType = {
  storage?: D1Store;
  db: D1Database;
  env: CloudflareBindings;
  conversationEndedAt?: string;
  adminUser?: AuthUser;
  voiceFindings?: VoiceFindingsSlot;
  voicePrefetch?: VoicePrefetchSlot;
  voiceParentRouting?: boolean;
  voiceSearchStart?: () => void;
  voiceTurnSignal?: AbortSignal;
  voiceEndCall?: () => void;
};

export const createRequestContext = (values: MastraRequestContextType) => {
  const requestContext = new RequestContext();
  if (values.storage) {
    requestContext.set("storage", values.storage);
  }
  requestContext.set("db", values.db);
  requestContext.set("env", values.env);
  if (values.conversationEndedAt) {
    requestContext.set("conversationEndedAt", values.conversationEndedAt);
  }
  if (values.adminUser) {
    requestContext.set("adminUser", values.adminUser);
  }
  if (values.voiceFindings) {
    requestContext.set("voiceFindings", values.voiceFindings);
  }
  if (values.voicePrefetch) {
    requestContext.set("voicePrefetch", values.voicePrefetch);
  }
  if (values.voiceParentRouting !== undefined) {
    requestContext.set("voiceParentRouting", values.voiceParentRouting);
  }
  if (values.voiceSearchStart) {
    requestContext.set("voiceSearchStart", values.voiceSearchStart);
  }
  if (values.voiceTurnSignal) {
    requestContext.set("voiceTurnSignal", values.voiceTurnSignal);
  }
  if (values.voiceEndCall) {
    requestContext.set("voiceEndCall", values.voiceEndCall);
  }
  return requestContext;
};
