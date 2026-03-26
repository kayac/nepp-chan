import { generateId, generateToken } from "~/lib/crypto";
import { adminInvitationRepository } from "~/repository/admin-invitation-repository";
import { adminUserRepository } from "~/repository/admin-user-repository";

export const createInvitation = async (
  d1: D1Database,
  username: string,
  invitedBy: string,
  role = "admin",
  expiryDays = 1,
) => {
  const normalizedUsername = username.toLowerCase().trim();

  const existingUser = await adminUserRepository.findByUsername(
    d1,
    normalizedUsername,
  );
  if (existingUser) {
    throw new Error("このユーザー名は既に登録されています");
  }

  const existingInvitation = await adminInvitationRepository.findByUsername(
    d1,
    normalizedUsername,
  );
  if (existingInvitation && !existingInvitation.usedAt) {
    await adminInvitationRepository.delete(d1, existingInvitation.id);
  }

  const id = generateId();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  await adminInvitationRepository.create(d1, {
    id,
    username: normalizedUsername,
    token,
    invitedBy,
    role,
    expiresAt: expiresAt.toISOString(),
    usedAt: null,
    createdAt: now.toISOString(),
  });

  return {
    id,
    token,
    username: normalizedUsername,
    expiresAt,
  };
};
