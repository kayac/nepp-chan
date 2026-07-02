import type { ToolExecutionContext } from "@mastra/core/tools";
import { ROLE_LEVEL } from "~/middleware/require-role";
import type { AdminRole, AuthUser } from "~/schemas/auth-schema";
import type { VoiceFindingsSlot } from "~/services/voice/findings-slot";

type ToolContext = ToolExecutionContext | undefined;

export const getDb = (context: ToolContext): D1Database | undefined =>
  context?.requestContext?.get("db") as D1Database | undefined;

export const getEnv = (context: ToolContext): CloudflareBindings | undefined =>
  context?.requestContext?.get("env") as CloudflareBindings | undefined;

export const getAdminUser = (context: ToolContext): AuthUser | undefined =>
  context?.requestContext?.get("adminUser") as AuthUser | undefined;

export const getConversationEndedAt = (
  context: ToolContext,
): string | undefined =>
  context?.requestContext?.get("conversationEndedAt") as string | undefined;

export const getVoiceFindings = (
  context: ToolContext,
): VoiceFindingsSlot | undefined =>
  context?.requestContext?.get("voiceFindings") as
    | VoiceFindingsSlot
    | undefined;

export const getVoiceSearchStart = (
  context: ToolContext,
): (() => void) | undefined =>
  context?.requestContext?.get("voiceSearchStart") as (() => void) | undefined;

type RequireDbResult = {
  db: D1Database;
};

type RequireAdminResult = {
  adminUser: AuthUser;
  db: D1Database;
};

type ToolError = {
  error: string;
  message: string;
};

export const requireDb = (
  context: ToolContext,
): RequireDbResult | { error: ToolError } => {
  const db = getDb(context);
  if (!db) {
    return {
      error: {
        error: "DB_NOT_AVAILABLE",
        message: "データベース接続がありません",
      },
    };
  }
  return { db };
};

export const requireAdmin = (
  context: ToolContext,
  minRole: AdminRole = "admin",
): RequireAdminResult | { error: ToolError } => {
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return {
      error: {
        error: "NOT_AUTHORIZED",
        message: "この機能は使用できません",
      },
    };
  }

  if (ROLE_LEVEL[adminUser.role] < ROLE_LEVEL[minRole]) {
    return {
      error: {
        error: "NOT_AUTHORIZED",
        message: "この機能は使用できません",
      },
    };
  }

  const db = getDb(context);
  if (!db) {
    return {
      error: {
        error: "DB_NOT_AVAILABLE",
        message: "データベース接続がありません",
      },
    };
  }

  return { adminUser, db };
};
