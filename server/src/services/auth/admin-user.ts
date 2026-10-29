import { adminInvitationRepository } from "~/repository/admin-invitation-repository";
import { adminSessionRepository } from "~/repository/admin-session-repository";
import { adminUserRepository } from "~/repository/admin-user-repository";

export const deleteAdminUser = async (
  d1: D1Database,
  user: { id: string; username: string },
) => {
  await adminSessionRepository.deleteByUserId(d1, user.id);
  await adminInvitationRepository.deleteByUsername(d1, user.username);
  await adminUserRepository.delete(d1, user.id);
};
