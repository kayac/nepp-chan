import { describe, expect, it } from "vitest";
import {
  getAdminUser,
  getConversationEndedAt,
  getDb,
  getEnv,
  requireAdmin,
  requireDb,
} from "~/mastra/tools/helpers";

// RuntimeContext のモック
const createMockContext = (values: Record<string, unknown>) => ({
  requestContext: {
    get: (key: string) => values[key],
  },
});

describe("ツールヘルパー関数", () => {
  describe("getDb", () => {
    it("context から db を取得できる", () => {
      const mockDb = { prepare: () => {} };
      const context = createMockContext({ db: mockDb });
      expect(getDb(context as never)).toBe(mockDb);
    });

    it("context が undefined の場合は undefined を返す", () => {
      expect(getDb(undefined)).toBeUndefined();
    });

    it("db が設定されていない場合は undefined を返す", () => {
      const context = createMockContext({});
      expect(getDb(context as never)).toBeUndefined();
    });
  });

  describe("getEnv", () => {
    it("context から env を取得できる", () => {
      const mockEnv = { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" };
      const context = createMockContext({ env: mockEnv });
      expect(getEnv(context as never)).toBe(mockEnv);
    });

    it("context が undefined の場合は undefined を返す", () => {
      expect(getEnv(undefined)).toBeUndefined();
    });
  });

  describe("getAdminUser", () => {
    it("context から adminUser を取得できる", () => {
      const mockUser = { id: "admin-1", email: "admin@example.com" };
      const context = createMockContext({ adminUser: mockUser });
      expect(getAdminUser(context as never)).toBe(mockUser);
    });

    it("context が undefined の場合は undefined を返す", () => {
      expect(getAdminUser(undefined)).toBeUndefined();
    });
  });

  describe("getConversationEndedAt", () => {
    it("context から conversationEndedAt を取得できる", () => {
      const context = createMockContext({
        conversationEndedAt: "2024-01-01T00:00:00Z",
      });
      expect(getConversationEndedAt(context as never)).toBe(
        "2024-01-01T00:00:00Z",
      );
    });

    it("context が undefined の場合は undefined を返す", () => {
      expect(getConversationEndedAt(undefined)).toBeUndefined();
    });
  });

  describe("requireDb", () => {
    it("db が存在する場合は { db } を返す", () => {
      const mockDb = { prepare: () => {} };
      const context = createMockContext({ db: mockDb });
      const result = requireDb(context as never);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.db).toBe(mockDb);
      }
    });

    it("db が存在しない場合はエラーオブジェクトを返す", () => {
      const context = createMockContext({});
      const result = requireDb(context as never);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.error).toBe("DB_NOT_AVAILABLE");
        expect(result.error.message).toBe("データベース接続がありません");
      }
    });

    it("context が undefined の場合はエラーオブジェクトを返す", () => {
      const result = requireDb(undefined);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.error).toBe("DB_NOT_AVAILABLE");
      }
    });
  });

  describe("requireAdmin", () => {
    it("adminUser と db が存在する場合は { adminUser, db } を返す", () => {
      const mockUser = {
        id: "admin-1",
        email: "admin@example.com",
        name: null,
        role: "admin",
        createdAt: "2024-01-01",
        updatedAt: null,
      };
      const mockDb = { prepare: () => {} };
      const context = createMockContext({
        adminUser: mockUser,
        db: mockDb,
      });

      const result = requireAdmin(context as never);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.adminUser).toBe(mockUser);
        expect(result.db).toBe(mockDb);
      }
    });

    it("adminUser が存在しない場合は NOT_AUTHORIZED エラーを返す", () => {
      const mockDb = { prepare: () => {} };
      const context = createMockContext({ db: mockDb });

      const result = requireAdmin(context as never);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.error).toBe("NOT_AUTHORIZED");
        expect(result.error.message).toBe("この機能は使用できません");
      }
    });

    it("db が存在しない場合は DB_NOT_AVAILABLE エラーを返す", () => {
      const mockUser = {
        id: "admin-1",
        email: "admin@example.com",
        name: null,
        role: "admin",
        createdAt: "2024-01-01",
        updatedAt: null,
      };
      const context = createMockContext({ adminUser: mockUser });

      const result = requireAdmin(context as never);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.error).toBe("DB_NOT_AVAILABLE");
      }
    });

    it("context が undefined の場合は NOT_AUTHORIZED エラーを返す", () => {
      const result = requireAdmin(undefined);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.error).toBe("NOT_AUTHORIZED");
      }
    });
  });
});
