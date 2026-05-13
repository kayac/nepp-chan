export const buildInvitationUrl = (origin: string, token: string) =>
  `${origin}/register?token=${token}`;

export const isExpired = (expiresAt: string, now: Date = new Date()) =>
  new Date(expiresAt) < now;
