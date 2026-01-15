import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import { generateId, generateToken } from "~/lib/crypto";
import { adminCredentialRepository } from "~/repository/admin-credential-repository";
import { adminInvitationRepository } from "~/repository/admin-invitation-repository";
import {
  type AdminUser,
  adminUserRepository,
} from "~/repository/admin-user-repository";
import { authChallengeRepository } from "~/repository/auth-challenge-repository";
import { createSession } from "./session";

const CHALLENGE_EXPIRY_MINUTES = 5;

export type WebAuthnConfig = {
  rpId: string;
  rpName: string;
  origin: string;
};

export const generateWebAuthnRegistrationOptions = async (
  d1: D1Database,
  config: WebAuthnConfig,
  token: string,
) => {
  const invitation = await adminInvitationRepository.findValidByToken(
    d1,
    token,
  );
  if (!invitation) {
    throw new Error("無効または期限切れの招待トークンです");
  }

  const existingUser = await adminUserRepository.findByEmail(
    d1,
    invitation.email,
  );
  if (existingUser) {
    throw new Error("このメールアドレスは既に登録されています");
  }

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userName: invitation.email,
    userDisplayName: invitation.email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
    timeout: 60000,
  });

  const challengeId = generateId();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000,
  );

  await authChallengeRepository.create(d1, {
    id: challengeId,
    challenge: options.challenge,
    type: "registration",
    email: invitation.email,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });

  return {
    options,
    challengeId,
    email: invitation.email,
    invitationId: invitation.id,
    role: invitation.role,
  };
};

export const verifyWebAuthnRegistration = async (
  d1: D1Database,
  config: WebAuthnConfig,
  challengeId: string,
  response: RegistrationResponseJSON,
  invitationId: string,
) => {
  const challenge = await authChallengeRepository.findValidById(
    d1,
    challengeId,
  );
  if (!challenge || challenge.type !== "registration") {
    throw new Error("認証リクエストが無効または期限切れです");
  }

  const invitation = await adminInvitationRepository.findById(d1, invitationId);
  if (!invitation || invitation.usedAt) {
    throw new Error("無効な招待です");
  }

  if (challenge.email !== invitation.email) {
    throw new Error("招待と認証リクエストのメールアドレスが一致しません");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpId,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("パスキーの検証に失敗しました");
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  const userId = generateId();
  const now = new Date().toISOString();

  await adminUserRepository.create(d1, {
    id: userId,
    email: invitation.email,
    name: null,
    role: invitation.role,
    createdAt: now,
    updatedAt: null,
  });

  const publicKeyBase64 = Buffer.from(credential.publicKey).toString(
    "base64url",
  );

  await adminCredentialRepository.create(d1, {
    id: credential.id,
    userId,
    publicKey: publicKeyBase64,
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: credential.transports
      ? JSON.stringify(credential.transports)
      : null,
    createdAt: now,
    lastUsedAt: null,
  });

  await adminInvitationRepository.markUsed(d1, invitationId);

  await authChallengeRepository.delete(d1, challengeId);

  const session = await createSession(d1, userId);

  const user = await adminUserRepository.findById(d1, userId);

  return {
    user,
    session,
  };
};

export const generateWebAuthnAuthenticationOptions = async (
  d1: D1Database,
  config: WebAuthnConfig,
) => {
  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: "required",
    timeout: 60000,
  });

  const challengeId = generateId();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000,
  );

  await authChallengeRepository.create(d1, {
    id: challengeId,
    challenge: options.challenge,
    type: "authentication",
    email: null,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });

  return {
    options,
    challengeId,
  };
};

export const verifyWebAuthnAuthentication = async (
  d1: D1Database,
  config: WebAuthnConfig,
  challengeId: string,
  response: AuthenticationResponseJSON,
) => {
  const challenge = await authChallengeRepository.findValidById(
    d1,
    challengeId,
  );
  if (!challenge || challenge.type !== "authentication") {
    throw new Error("認証リクエストが無効または期限切れです");
  }

  const credentialIdBase64 = response.id;
  const credential = await adminCredentialRepository.findById(
    d1,
    credentialIdBase64,
  );
  if (!credential) {
    throw new Error("登録されていないクレデンシャルです");
  }

  const publicKeyBuffer = Buffer.from(credential.publicKey, "base64url");

  const transports = credential.transports
    ? (JSON.parse(credential.transports) as AuthenticatorTransportFuture[])
    : undefined;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpId,
    requireUserVerification: true,
    credential: {
      id: credential.id,
      publicKey: publicKeyBuffer,
      counter: credential.counter,
      transports,
    },
  });

  if (!verification.verified) {
    throw new Error("認証に失敗しました");
  }

  await adminCredentialRepository.updateCounter(
    d1,
    credentialIdBase64,
    verification.authenticationInfo.newCounter,
  );

  await authChallengeRepository.delete(d1, challengeId);

  const user = await adminUserRepository.findById(d1, credential.userId);
  if (!user) {
    throw new Error("ユーザーが見つかりません");
  }

  const session = await createSession(d1, user.id);

  return {
    user,
    session,
  };
};

export const createInvitation = async (
  d1: D1Database,
  email: string,
  invitedBy: string,
  role = "admin",
  expiryDays = 1,
) => {
  const existingUser = await adminUserRepository.findByEmail(d1, email);
  if (existingUser) {
    throw new Error("このメールアドレスは既に登録されています");
  }

  const existingInvitation = await adminInvitationRepository.findByEmail(
    d1,
    email,
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
    email,
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
    email,
    expiresAt,
  };
};

export type { AdminUser };
