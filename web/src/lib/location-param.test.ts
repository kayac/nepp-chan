import { beforeEach, describe, expect, it, vi } from "vitest";

const searchString = { current: "" };
vi.mock("~/lib/redirect", () => ({
  getCurrentSearchParams: () => new URLSearchParams(searchString.current),
}));

const { getLocationParam } = await import("./location-param");

beforeEach(() => {
  searchString.current = "";
});

describe("getLocationParam", () => {
  it("location があれば返す", () => {
    searchString.current = "?location=天塩川温泉";
    expect(getLocationParam()).toBe("天塩川温泉");
  });

  it("location が無ければ null", () => {
    searchString.current = "?foo=bar";
    expect(getLocationParam()).toBeNull();
  });

  it("location が空なら null", () => {
    searchString.current = "?location=";
    expect(getLocationParam()).toBeNull();
  });
});
