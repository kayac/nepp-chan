import { generateToken } from "~/lib/crypto";
import { adminSessionRepository } from "~/repository/admin-session-repository";
import {
  type AdminUser,
  adminUserRepository,
} from "~/repository/admin-user-repository";

const SESSION_DURATION_DAYS = 30;
const SESSION_ABSOLUTE_MAX_DAYS = 90;

export const createSession = async (d1: D1Database, userId: string) => {
  const sessionId = generateToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  await adminSessionRepository.create(d1, {
    id: sessionId,
    userId,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    lastAccessedAt: now.toISOString(),
  });

  return {
    sessionId,
    expiresAt,
  };
};

export const validateSession = async (d1: D1Database, sessionId: string) => {
  const session = await adminSessionRepository.findValidById(
    d1,
    sessionId,
    SESSION_ABSOLUTE_MAX_DAYS,
  );
  if (!session) {
    return null;
  }

  await adminSessionRepository.updateLastAccessed(d1, sessionId);

  return session;
};

export const getUserFromSession = async (
  d1: D1Database,
  sessionId: string,
): Promise<AdminUser | null> => {
  const session = await validateSession(d1, sessionId);
  if (!session) {
    return null;
  }

  const user = await adminUserRepository.findById(d1, session.userId);
  return user;
};

export const deleteSession = async (d1: D1Database, sessionId: string) => {
  await adminSessionRepository.delete(d1, sessionId);
  return { success: true };
};

export const deleteUserSessions = async (d1: D1Database, userId: string) => {
  await adminSessionRepository.deleteByUserId(d1, userId);
  return { success: true };
};

export const cleanupExpiredSessions = async (d1: D1Database) => {
  await adminSessionRepository.deleteExpired(d1);
  return { success: true };
};
