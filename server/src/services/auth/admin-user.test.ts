import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/admin-invitation-repository", () => ({
  adminInvitationRepository: {
    deleteByUsername: vi.fn(),
  },
}));

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: {
    deleteByUserId: vi.fn(),
  },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: {
    delete: vi.fn(),
  },
}));

const { adminInvitationRepository } = await import(
  "~/repository/admin-invitation-repository"
);
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { deleteAdminUser } = await import("./admin-user");

const fakeD1 = {} as D1Database;

describe("deleteAdminUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("セッション・招待・ユーザー本体を削除する", async () => {
    await deleteAdminUser(fakeD1, { id: "u-1", username: "alice" });

    expect(adminSessionRepository.deleteByUserId).toHaveBeenCalledWith(
      fakeD1,
      "u-1",
    );
    expect(adminInvitationRepository.deleteByUsername).toHaveBeenCalledWith(
      fakeD1,
      "alice",
    );
    expect(adminUserRepository.delete).toHaveBeenCalledWith(fakeD1, "u-1");
  });
});
