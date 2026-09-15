import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRole } from "./useRole";

const buildUser = (role: "super_admin" | "admin" | "staff") => ({
  id: "u-1",
  username: "x",
  name: null,
  role,
});

describe("useRole", () => {
  it("user が null なら全 hasRole で false", () => {
    const { result } = renderHook(() => useRole(null));

    expect(result.current.role).toBeUndefined();
    expect(result.current.hasRole("staff")).toBe(false);
    expect(result.current.isSuperAdmin).toBe(false);
  });

  it("staff ロールは admin / super_admin の hasRole で false", () => {
    const { result } = renderHook(() => useRole(buildUser("staff")));

    expect(result.current.hasRole("staff")).toBe(true);
    expect(result.current.hasRole("admin")).toBe(false);
    expect(result.current.hasRole("super_admin")).toBe(false);
  });

  it("admin ロールは staff / admin に対して true、super_admin は false", () => {
    const { result } = renderHook(() => useRole(buildUser("admin")));

    expect(result.current.hasRole("staff")).toBe(true);
    expect(result.current.hasRole("admin")).toBe(true);
    expect(result.current.hasRole("super_admin")).toBe(false);
    expect(result.current.isSuperAdmin).toBe(false);
  });

  it("super_admin はすべての hasRole で true、isSuperAdmin も true", () => {
    const { result } = renderHook(() => useRole(buildUser("super_admin")));

    expect(result.current.hasRole("staff")).toBe(true);
    expect(result.current.hasRole("admin")).toBe(true);
    expect(result.current.hasRole("super_admin")).toBe(true);
    expect(result.current.isSuperAdmin).toBe(true);
  });
});
