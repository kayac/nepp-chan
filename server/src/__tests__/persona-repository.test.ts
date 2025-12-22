import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Persona,
  personaRepository,
} from "~/repository/persona-repository";

const createMockDb = () => {
  const mockResults: Persona[] = [];

  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        run: vi.fn(() => Promise.resolve({ success: true })),
        first: vi.fn(() => Promise.resolve(mockResults[0] ?? null)),
        all: vi.fn(() => Promise.resolve({ results: mockResults })),
      })),
    })),
    _setMockResults: (results: Persona[]) => {
      mockResults.length = 0;
      mockResults.push(...results);
    },
  };
};

describe("personaRepository", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe("create", () => {
    it("新しいペルソナを作成できる", async () => {
      const input = {
        id: "test-id",
        resourceId: "village-1",
        category: "好み",
        tags: "男性,高齢者",
        content: "村民は地元産の野菜を好む",
        source: "会話サマリー",
        createdAt: "2024-01-01T00:00:00Z",
      };

      const result = await personaRepository.create(
        mockDb as unknown as D1Database,
        input,
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe("test-id");
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO persona"),
      );
    });

    it("オプション項目なしでも作成できる", async () => {
      const input = {
        id: "test-id",
        resourceId: "village-1",
        category: "価値観",
        content: "助け合いを大切にする",
        createdAt: "2024-01-01T00:00:00Z",
      };

      const result = await personaRepository.create(
        mockDb as unknown as D1Database,
        input,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("update", () => {
    it("ペルソナの内容を更新できる", async () => {
      const result = await personaRepository.update(
        mockDb as unknown as D1Database,
        "test-id",
        { content: "更新された内容" },
      );

      expect(result.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE persona"),
      );
    });

    it("複数項目を同時に更新できる", async () => {
      const result = await personaRepository.update(
        mockDb as unknown as D1Database,
        "test-id",
        {
          category: "新カテゴリ",
          tags: "新タグ",
          content: "新しい内容",
        },
      );

      expect(result.success).toBe(true);
    });

    it("更新項目がない場合はエラーを返す", async () => {
      const result = await personaRepository.update(
        mockDb as unknown as D1Database,
        "test-id",
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("更新する項目がありません");
    });
  });

  describe("findById", () => {
    it("IDでペルソナを取得できる", async () => {
      const mockPersona: Persona = {
        id: "test-id",
        resourceId: "village-1",
        category: "好み",
        tags: "男性",
        content: "テスト内容",
        source: null,
        topic: null,
        sentiment: null,
        demographicSummary: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: null,
      };
      mockDb._setMockResults([mockPersona]);

      const result = await personaRepository.findById(
        mockDb as unknown as D1Database,
        "test-id",
      );

      expect(result).toEqual(mockPersona);
    });

    it("存在しないIDの場合はnullを返す", async () => {
      mockDb._setMockResults([]);

      const result = await personaRepository.findById(
        mockDb as unknown as D1Database,
        "non-existent",
      );

      expect(result).toBeNull();
    });
  });

  describe("findByResourceId", () => {
    it("リソースIDでペルソナ一覧を取得できる", async () => {
      const mockPersonas: Persona[] = [
        {
          id: "1",
          resourceId: "village-1",
          category: "好み",
          tags: null,
          content: "内容1",
          source: null,
          topic: null,
          sentiment: null,
          demographicSummary: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: null,
        },
        {
          id: "2",
          resourceId: "village-1",
          category: "価値観",
          tags: null,
          content: "内容2",
          source: null,
          topic: null,
          sentiment: null,
          demographicSummary: null,
          createdAt: "2024-01-02T00:00:00Z",
          updatedAt: null,
        },
      ];
      mockDb._setMockResults(mockPersonas);

      const result = await personaRepository.findByResourceId(
        mockDb as unknown as D1Database,
        "village-1",
      );

      expect(result).toHaveLength(2);
    });
  });

  describe("search", () => {
    it("カテゴリで検索できる", async () => {
      await personaRepository.search(
        mockDb as unknown as D1Database,
        "village-1",
        {
          category: "好み",
        },
      );

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("category = ?"),
      );
    });

    it("タグで検索できる", async () => {
      await personaRepository.search(
        mockDb as unknown as D1Database,
        "village-1",
        {
          tags: ["男性", "高齢者"],
        },
      );

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("tags LIKE ?"),
      );
    });

    it("キーワードで検索できる", async () => {
      await personaRepository.search(
        mockDb as unknown as D1Database,
        "village-1",
        {
          keyword: "野菜",
        },
      );

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("content LIKE ?"),
      );
    });

    it("複合条件で検索できる", async () => {
      await personaRepository.search(
        mockDb as unknown as D1Database,
        "village-1",
        {
          category: "好み",
          tags: ["男性"],
          keyword: "野菜",
          limit: 10,
        },
      );

      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("ペルソナを削除できる", async () => {
      const result = await personaRepository.delete(
        mockDb as unknown as D1Database,
        "test-id",
      );

      expect(result.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM persona"),
      );
    });
  });
});
