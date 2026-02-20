import type { ToolExecutionContext } from "@mastra/core/tools";
import type { AdminUser } from "~/db";

type ToolContext = ToolExecutionContext | undefined;

export const getDb = (context: ToolContext): D1Database | undefined =>
  context?.requestContext?.get("db") as D1Database | undefined;

export const getEnv = (context: ToolContext): CloudflareBindings | undefined =>
  context?.requestContext?.get("env") as CloudflareBindings | undefined;

export const getAdminUser = (context: ToolContext): AdminUser | undefined =>
  context?.requestContext?.get("adminUser") as AdminUser | undefined;

export const getConversationEndedAt = (
  context: ToolContext,
): string | undefined =>
  context?.requestContext?.get("conversationEndedAt") as string | undefined;

interface RequireDbResult {
  db: D1Database;
}

interface RequireAdminResult {
  adminUser: AdminUser;
  db: D1Database;
}

interface ToolError {
  error: string;
  message: string;
}

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
