import { beforeEach, describe, expect, it, vi } from "vitest";

import { adminSessionRepository } from "~/repository/admin-session-repository";
import { adminUserRepository } from "~/repository/admin-user-repository";
import * as sessionService from "~/services/auth/session";

// モック
vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: {
    create: vi.fn(),
    findValidById: vi.fn(),
    updateLastAccessed: vi.fn(),
    delete: vi.fn(),
    deleteByUserId: vi.fn(),
    deleteExpired: vi.fn(),
  },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: {
    findById: vi.fn(),
  },
}));

describe("sessionService", () => {
  const mockDb = {} as D1Database;

  const testUser = {
    id: "user-1",
    email: "admin@example.com",
    name: "管理者",
    role: "admin",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: null,
  };

  const testSession = {
    id: "session-123",
    userId: testUser.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
    lastAccessedAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("新しいセッションを作成できる", async () => {
      vi.mocked(adminSessionRepository.create).mockResolvedValue({
        success: true,
        id: "session-new",
      });

      const result = await sessionService.createSession(mockDb, testUser.id);

      expect(result).toHaveProperty("sessionId");
      expect(result).toHaveProperty("expiresAt");
      expect(typeof result.sessionId).toBe("string");
      expect(result.sessionId.length).toBe(64); // 32バイトの16進数表現
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("セッションIDは64文字の16進数文字列である", async () => {
      vi.mocked(adminSessionRepository.create).mockResolvedValue({
        success: true,
        id: "test",
      });

      const result = await sessionService.createSession(mockDb, testUser.id);

      expect(result.sessionId).toMatch(/^[0-9a-f]{64}$/);
    });

    it("有効期限は30日後である", async () => {
      vi.mocked(adminSessionRepository.create).mockResolvedValue({
        success: true,
        id: "test",
      });

      const before = Date.now();
      const result = await sessionService.createSession(mockDb, testUser.id);
      const after = Date.now();

      const expectedMinExpiry = before + 30 * 24 * 60 * 60 * 1000;
      const expectedMaxExpiry = after + 30 * 24 * 60 * 60 * 1000;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
        expectedMinExpiry,
      );
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it("リポジトリの create が正しく呼び出される", async () => {
      vi.mocked(adminSessionRepository.create).mockResolvedValue({
        success: true,
        id: "test",
      });

      await sessionService.createSession(mockDb, testUser.id);

      expect(adminSessionRepository.create).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          userId: testUser.id,
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          lastAccessedAt: expect.any(String),
        }),
      );
    });
  });

  describe("validateSession", () => {
    it("有効なセッションを返す", async () => {
      vi.mocked(adminSessionRepository.findValidById).mockResolvedValue(
        testSession,
      );
      vi.mocked(adminSessionRepository.updateLastAccessed).mockResolvedValue({
        success: true,
      });

      const result = await sessionService.validateSession(
        mockDb,
        testSession.id,
      );

      expect(result).toEqual(testSession);
      expect(adminSessionRepository.findValidById).toHaveBeenCalledWith(
        mockDb,
        testSession.id,
      );
    });

    it("有効なセッションの場合は最終アクセス日時を更新する", async () => {
      vi.mocked(adminSessionRepository.findValidById).mockResolvedValue(
        testSession,
      );
      vi.mocked(adminSessionRepository.updateLastAccessed).mockResolvedValue({
        success: true,
      });

      await sessionService.validateSession(mockDb, testSession.id);

      expect(adminSessionRepository.updateLastAccessed).toHaveBeenCalledWith(
        mockDb,
        testSession.id,
      );
    });

    it("無効なセッションの場合は null を返す", async () => {
      vi.mocked(adminSessionRepository.findValidById).mockResolvedValue(null);

      const result = await sessionService.validateSession(
        mockDb,
        "invalid-session",
      );

      expect(result).toBeNull();
      expect(adminSessionRepository.updateLastAccessed).not.toHaveBeenCalled();
    });
  });

  describe("getUserFromSession", () => {
    it("セッションからユーザーを取得できる", async () => {
      vi.mocked(adminSessionRepository.findValidById).mockResolvedValue(
        testSession,
      );
      vi.mocked(adminSessionRepository.updateLastAccessed).mockResolvedValue({
        success: true,
      });
      vi.mocked(adminUserRepository.findById).mockResolvedValue(testUser);

      const result = await sessionService.getUserFromSession(
        mockDb,
        testSession.id,
      );

      expect(result).toEqual(testUser);
      expect(adminUserRepository.findById).toHaveBeenCalledWith(
        mockDb,
        testUser.id,
      );
    });

    it("無効なセッションの場合は null を返す", async () => {
      vi.mocked(adminSessionRepository.findValidById).mockResolvedValue(null);

      const result = await sessionService.getUserFromSession(
        mockDb,
        "invalid-session",
      );

      expect(result).toBeNull();
      expect(adminUserRepository.findById).not.toHaveBeenCalled();
    });

    it("ユーザーが見つからない場合は null を返す", async () => {
      vi.mocked(adminSessionRepository.findValidById).mockResolvedValue(
        testSession,
      );
      vi.mocked(adminSessionRepository.updateLastAccessed).mockResolvedValue({
        success: true,
      });
      vi.mocked(adminUserRepository.findById).mockResolvedValue(null);

      const result = await sessionService.getUserFromSession(
        mockDb,
        testSession.id,
      );

      expect(result).toBeNull();
    });
  });

  describe("deleteSession", () => {
    it("セッションを削除できる", async () => {
      vi.mocked(adminSessionRepository.delete).mockResolvedValue({
        success: true,
      });

      const result = await sessionService.deleteSession(mockDb, testSession.id);

      expect(result).toEqual({ success: true });
      expect(adminSessionRepository.delete).toHaveBeenCalledWith(
        mockDb,
        testSession.id,
      );
    });
  });

  describe("deleteUserSessions", () => {
    it("ユーザーの全セッションを削除できる", async () => {
      vi.mocked(adminSessionRepository.deleteByUserId).mockResolvedValue({
        success: true,
      });

      const result = await sessionService.deleteUserSessions(
        mockDb,
        testUser.id,
      );

      expect(result).toEqual({ success: true });
      expect(adminSessionRepository.deleteByUserId).toHaveBeenCalledWith(
        mockDb,
        testUser.id,
      );
    });
  });

  describe("cleanupExpiredSessions", () => {
    it("期限切れセッションをクリーンアップできる", async () => {
      vi.mocked(adminSessionRepository.deleteExpired).mockResolvedValue({
        success: true,
      });

      const result = await sessionService.cleanupExpiredSessions(mockDb);

      expect(result).toEqual({ success: true });
      expect(adminSessionRepository.deleteExpired).toHaveBeenCalledWith(mockDb);
    });
  });

  describe("getSessionCookieOptions", () => {
    it("正しいCookieオプションを返す", () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const options = sessionService.getSessionCookieOptions(expiresAt);

      expect(options).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        path: "/",
        expires: expiresAt,
      });
    });

    it("httpOnly が true である（XSS対策）", () => {
      const options = sessionService.getSessionCookieOptions(new Date());

      expect(options.httpOnly).toBe(true);
    });

    it("secure が true である（HTTPS必須）", () => {
      const options = sessionService.getSessionCookieOptions(new Date());

      expect(options.secure).toBe(true);
    });

    it("sameSite が Strict である（CSRF対策）", () => {
      const options = sessionService.getSessionCookieOptions(new Date());

      expect(options.sameSite).toBe("Strict");
    });
  });
});
