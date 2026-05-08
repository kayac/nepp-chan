import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/crypto", () => ({
  generateId: vi.fn(),
  generateToken: vi.fn(),
}));

vi.mock("~/repository/admin-invitation-repository", () => ({
  adminInvitationRepository: {
    findByUsername: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: {
    findByUsername: vi.fn(),
  },
}));

const { generateId, generateToken } = await import("~/lib/crypto");
const { adminInvitationRepository } = await import(
  "~/repository/admin-invitation-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { createInvitation } = await import("./invitation");

const fakeD1 = {} as D1Database;

describe("createInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateId).mockReturnValue("inv-id");
    vi.mocked(generateToken).mockReturnValue("inv-token");
  });

  it("正常系: 招待を作って id / token / username / expiresAt を返す", async () => {
    vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
    vi.mocked(adminInvitationRepository.findByUsername).mockResolvedValue(null);

    const result = await createInvitation(fakeD1, "TestUser", "u-1");

    expect(result).toMatchObject({
      id: "inv-id",
      token: "inv-token",
      username: "testuser",
    });
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(adminInvitationRepository.create).toHaveBeenCalledWith(
      fakeD1,
      expect.objectContaining({
        username: "testuser",
        invitedBy: "u-1",
        role: "admin",
      }),
    );
  });

  it("username を小文字 + trim で正規化", async () => {
    vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
    vi.mocked(adminInvitationRepository.findByUsername).mockResolvedValue(null);

    await createInvitation(fakeD1, "  Mixed.Case  ", "u-1");

    expect(adminUserRepository.findByUsername).toHaveBeenCalledWith(
      fakeD1,
      "mixed.case",
    );
  });

  it("既登録ユーザー名は throw する", async () => {
    vi.mocked(adminUserRepository.findByUsername).mockResolvedValue({
      id: "u-x",
      username: "exists",
      name: null,
      role: "admin",
      passwordHash: "h",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: null,
    });

    await expect(createInvitation(fakeD1, "exists", "u-1")).rejects.toThrow(
      /既に登録/,
    );
    expect(adminInvitationRepository.create).not.toHaveBeenCalled();
  });

  it("未使用の既存招待は削除してから新規作成", async () => {
    vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
    vi.mocked(adminInvitationRepository.findByUsername).mockResolvedValue({
      id: "old-inv",
      username: "user",
      token: "old-token",
      invitedBy: "u-0",
      role: "admin",
      expiresAt: "2025-12-31T00:00:00Z",
      usedAt: null,
      createdAt: "2025-01-01T00:00:00Z",
    });

    await createInvitation(fakeD1, "user", "u-1");

    expect(adminInvitationRepository.delete).toHaveBeenCalledWith(
      fakeD1,
      "old-inv",
    );
    expect(adminInvitationRepository.create).toHaveBeenCalled();
  });

  it("使用済み招待が残っていても削除せず新規作成する", async () => {
    vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
    vi.mocked(adminInvitationRepository.findByUsername).mockResolvedValue({
      id: "used-inv",
      username: "user",
      token: "old-token",
      invitedBy: "u-0",
      role: "admin",
      expiresAt: "2025-12-31T00:00:00Z",
      usedAt: "2025-01-01T00:00:00Z",
      createdAt: "2025-01-01T00:00:00Z",
    });

    await createInvitation(fakeD1, "user", "u-1");

    expect(adminInvitationRepository.delete).not.toHaveBeenCalled();
  });

  it("expiryDays で有効期限を制御できる", async () => {
    vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
    vi.mocked(adminInvitationRepository.findByUsername).mockResolvedValue(null);

    const before = Date.now();
    const result = await createInvitation(fakeD1, "u", "i", "admin", 3);
    const expiresAtMs = result.expiresAt.getTime();

    const threeDays = 3 * 24 * 60 * 60 * 1000;
    expect(expiresAtMs - before).toBeGreaterThanOrEqual(threeDays - 1000);
    expect(expiresAtMs - before).toBeLessThanOrEqual(threeDays + 1000);
  });

  it("role を渡せる", async () => {
    vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
    vi.mocked(adminInvitationRepository.findByUsername).mockResolvedValue(null);

    await createInvitation(fakeD1, "u", "i", "super_admin");

    expect(adminInvitationRepository.create).toHaveBeenCalledWith(
      fakeD1,
      expect.objectContaining({ role: "super_admin" }),
    );
  });
});
