import { beforeEach, describe, expect, it, vi } from "vitest";

import { adminCredentialRepository } from "~/repository/admin-credential-repository";
import { adminInvitationRepository } from "~/repository/admin-invitation-repository";
import { adminUserRepository } from "~/repository/admin-user-repository";
import { authChallengeRepository } from "~/repository/auth-challenge-repository";
import * as webauthn from "~/services/auth/webauthn";

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock("~/repository/admin-credential-repository", () => ({
  adminCredentialRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    updateCounter: vi.fn(),
  },
}));

vi.mock("~/repository/admin-invitation-repository", () => ({
  adminInvitationRepository: {
    findValidByToken: vi.fn(),
    findById: vi.fn(),
    markUsed: vi.fn(),
  },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("~/repository/auth-challenge-repository", () => ({
  authChallengeRepository: {
    create: vi.fn(),
    findValidById: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/services/auth/session", () => ({
  createSession: vi.fn().mockResolvedValue({
    sessionId: "mock-session-id",
    expiresAt: new Date(),
  }),
}));

const { verifyRegistrationResponse, verifyAuthenticationResponse } =
  await import("@simplewebauthn/server");

describe("webauthn service", () => {
  const mockDb = {} as D1Database;
  const mockConfig: webauthn.WebAuthnConfig = {
    rpId: "localhost",
    rpName: "Test App",
    origin: "http://localhost:5173",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyWebAuthnRegistration", () => {
    const mockInvitation = {
      id: "invitation-1",
      email: "test@example.com",
      token: "test-token",
      invitedBy: "system",
      role: "admin",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      usedAt: null,
      createdAt: new Date().toISOString(),
    };

    const mockChallenge = {
      id: "challenge-1",
      challenge: "test-challenge",
      type: "registration",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    it("credential.id をそのまま保存する（二重エンコードしない）", async () => {
      const expectedCredentialId =
        "rxx8a0Bu9CUD4-SmICvlBvE_APECS0USGQMFIi2NTn_r6BVI49y3P52b-5EYbVTMI5V8QqYvHNLovJVaL2UJ";

      vi.mocked(authChallengeRepository.findValidById).mockResolvedValue(
        mockChallenge,
      );
      vi.mocked(adminInvitationRepository.findById).mockResolvedValue(
        mockInvitation,
      );
      vi.mocked(verifyRegistrationResponse).mockResolvedValue({
        verified: true,
        registrationInfo: {
          fmt: "none",
          aaguid: "00000000-0000-0000-0000-000000000000",
          credential: {
            id: expectedCredentialId,
            publicKey: new Uint8Array([1, 2, 3, 4]),
            counter: 0,
            transports: ["internal"],
          },
          credentialType: "public-key",
          attestationObject: new Uint8Array(),
          userVerified: true,
          credentialDeviceType: "singleDevice",
          credentialBackedUp: false,
          origin: mockConfig.origin,
        },
      });
      vi.mocked(adminUserRepository.create).mockResolvedValue({
        success: true,
        id: "user-1",
      });
      vi.mocked(adminCredentialRepository.create).mockResolvedValue({
        success: true,
        id: expectedCredentialId,
      });
      vi.mocked(adminUserRepository.findById).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        name: null,
        role: "admin",
        createdAt: new Date().toISOString(),
        updatedAt: null,
      });

      await webauthn.verifyWebAuthnRegistration(
        mockDb,
        mockConfig,
        "challenge-1",
        {} as Parameters<typeof webauthn.verifyWebAuthnRegistration>[3],
        "invitation-1",
      );

      expect(adminCredentialRepository.create).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          id: expectedCredentialId,
        }),
      );

      const createCall = vi.mocked(adminCredentialRepository.create).mock
        .calls[0];
      const savedId = createCall[1].id;
      expect(savedId).toBe(expectedCredentialId);
      expect(savedId).not.toContain("cnh4OGEwQnU5Q1VENC");
    });

    it("publicKey は base64url エンコードして保存する", async () => {
      const publicKeyBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const expectedPublicKeyBase64 =
        Buffer.from(publicKeyBytes).toString("base64url");

      vi.mocked(authChallengeRepository.findValidById).mockResolvedValue(
        mockChallenge,
      );
      vi.mocked(adminInvitationRepository.findById).mockResolvedValue(
        mockInvitation,
      );
      vi.mocked(verifyRegistrationResponse).mockResolvedValue({
        verified: true,
        registrationInfo: {
          fmt: "none",
          aaguid: "00000000-0000-0000-0000-000000000000",
          credential: {
            id: "test-credential-id",
            publicKey: publicKeyBytes,
            counter: 0,
          },
          credentialType: "public-key",
          attestationObject: new Uint8Array(),
          userVerified: true,
          credentialDeviceType: "singleDevice",
          credentialBackedUp: false,
          origin: mockConfig.origin,
        },
      });
      vi.mocked(adminUserRepository.create).mockResolvedValue({
        success: true,
        id: "user-1",
      });
      vi.mocked(adminCredentialRepository.create).mockResolvedValue({
        success: true,
        id: "test-credential-id",
      });
      vi.mocked(adminUserRepository.findById).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        name: null,
        role: "admin",
        createdAt: new Date().toISOString(),
        updatedAt: null,
      });

      await webauthn.verifyWebAuthnRegistration(
        mockDb,
        mockConfig,
        "challenge-1",
        {} as Parameters<typeof webauthn.verifyWebAuthnRegistration>[3],
        "invitation-1",
      );

      expect(adminCredentialRepository.create).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          publicKey: expectedPublicKeyBase64,
        }),
      );
    });
  });

  describe("verifyWebAuthnAuthentication", () => {
    const mockChallenge = {
      id: "challenge-1",
      challenge: "test-challenge",
      type: "authentication",
      email: null,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    const mockCredential = {
      id: "test-credential-id",
      userId: "user-1",
      publicKey: Buffer.from([1, 2, 3, 4]).toString("base64url"),
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
      transports: null,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };

    const mockUser = {
      id: "user-1",
      email: "test@example.com",
      name: null,
      role: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    it("response.id でクレデンシャルを検索する", async () => {
      const credentialId = "test-credential-id";

      vi.mocked(authChallengeRepository.findValidById).mockResolvedValue(
        mockChallenge,
      );
      vi.mocked(adminCredentialRepository.findById).mockResolvedValue(
        mockCredential,
      );
      vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
        verified: true,
        authenticationInfo: {
          credentialID: credentialId,
          newCounter: 1,
          userVerified: true,
          credentialDeviceType: "singleDevice",
          credentialBackedUp: false,
          origin: "http://localhost:5173",
          rpID: "localhost",
        },
      });
      vi.mocked(adminUserRepository.findById).mockResolvedValue(mockUser);

      await webauthn.verifyWebAuthnAuthentication(
        mockDb,
        mockConfig,
        "challenge-1",
        {
          id: credentialId,
          rawId: credentialId,
          type: "public-key",
          response: {
            clientDataJSON: "",
            authenticatorData: "",
            signature: "",
          },
          authenticatorAttachment: "platform",
          clientExtensionResults: {},
        },
      );

      expect(adminCredentialRepository.findById).toHaveBeenCalledWith(
        mockDb,
        credentialId,
      );
    });

    it("登録されていないクレデンシャルの場合はエラーを返す", async () => {
      vi.mocked(authChallengeRepository.findValidById).mockResolvedValue(
        mockChallenge,
      );
      vi.mocked(adminCredentialRepository.findById).mockResolvedValue(null);

      await expect(
        webauthn.verifyWebAuthnAuthentication(
          mockDb,
          mockConfig,
          "challenge-1",
          {
            id: "unknown-credential",
            rawId: "unknown-credential",
            type: "public-key",
            response: {
              clientDataJSON: "",
              authenticatorData: "",
              signature: "",
            },
            authenticatorAttachment: "platform",
            clientExtensionResults: {},
          },
        ),
      ).rejects.toThrow("登録されていないクレデンシャルです");
    });
  });
});
