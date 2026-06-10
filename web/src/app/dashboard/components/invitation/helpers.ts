export const buildInvitationUrl = (origin: string, token: string) =>
  `${origin}/register?token=${token}`;

export const isExpired = (expiresAt: string, now: Date = new Date()) =>
  new Date(expiresAt) < now;

interface DeletableInvitation {
  id: string;
  username: string;
  usedAt: string | null;
  userId: string | null;
}

export type DeleteAction =
  | { type: "invitation"; id: string }
  | { type: "user"; userId: string };

/**
 * 招待行の「削除」が何を消すべきかを決める。
 * 未使用・期限切れの招待は招待レコードの削除、登録済みはアカウント本体の削除
 * （super_admin 限定・自分自身は不可）。
 */
export const resolveDeleteAction = (
  invitation: DeletableInvitation,
  isSuperAdmin: boolean,
  currentUsername: string | undefined,
): DeleteAction | null => {
  if (!invitation.usedAt) {
    return { type: "invitation", id: invitation.id };
  }
  if (
    !isSuperAdmin ||
    invitation.username === currentUsername ||
    !invitation.userId
  ) {
    return null;
  }
  return { type: "user", userId: invitation.userId };
};
