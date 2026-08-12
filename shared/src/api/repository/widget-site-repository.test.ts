import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createWidgetSiteRepository } from "./widget-site-repository";

const repo = createWidgetSiteRepository(testApiClient);

const site = {
  id: "ws-1",
  host: "vill.otoineppu.hokkaido.jp",
  instructions: "行政手続きの案内を優先する",
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: null,
};

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("widget-site-repository", () => {
  it("fetchWidgetSites", async () => {
    server.use(
      http.get(`${API}/admin/widget-sites`, () =>
        HttpResponse.json({ sites: [site] }),
      ),
    );

    const result = await repo.fetchWidgetSites();
    expect(result?.sites).toEqual([site]);
  });

  it("createWidgetSite: host + instructions を送る", async () => {
    server.use(
      http.post(`${API}/admin/widget-sites`, async ({ request }) => {
        expect(await request.json()).toEqual({
          host: "example.com",
          instructions: "案内文",
        });
        return HttpResponse.json(site, { status: 201 });
      }),
    );

    const result = await repo.createWidgetSite({
      host: "example.com",
      instructions: "案内文",
    });
    expect(result?.id).toBe("ws-1");
  });

  it("updateWidgetSite: PUT", async () => {
    server.use(
      http.put(`${API}/admin/widget-sites/ws-1`, async ({ request }) => {
        expect(await request.json()).toEqual({
          host: "example.com",
          instructions: "書き換えた案内文",
        });
        return HttpResponse.json(site);
      }),
    );

    const result = await repo.updateWidgetSite("ws-1", {
      host: "example.com",
      instructions: "書き換えた案内文",
    });
    expect(result?.host).toBe("vill.otoineppu.hokkaido.jp");
  });

  it("deleteWidgetSite: DELETE", async () => {
    let called = false;
    server.use(
      http.delete(`${API}/admin/widget-sites/ws-1`, () => {
        called = true;
        return HttpResponse.json({ message: "ok" });
      }),
    );

    await repo.deleteWidgetSite("ws-1");
    expect(called).toBe(true);
  });

  it("失敗系: fetchWidgetSites 403 は throw", async () => {
    server.use(
      http.get(`${API}/admin/widget-sites`, () =>
        HttpResponse.json({ error: { message: "forbidden" } }, { status: 403 }),
      ),
    );

    await expect(repo.fetchWidgetSites()).rejects.toBeDefined();
  });

  it("失敗系: createWidgetSite 409 は throw", async () => {
    server.use(
      http.post(`${API}/admin/widget-sites`, () =>
        HttpResponse.json({ error: { message: "duplicate" } }, { status: 409 }),
      ),
    );

    await expect(
      repo.createWidgetSite({ host: "example.com", instructions: "案内文" }),
    ).rejects.toBeDefined();
  });

  it("失敗系: updateWidgetSite 404 は throw", async () => {
    server.use(
      http.put(`${API}/admin/widget-sites/missing`, () =>
        HttpResponse.json({ error: { message: "not found" } }, { status: 404 }),
      ),
    );

    await expect(
      repo.updateWidgetSite("missing", {
        host: "example.com",
        instructions: "案内文",
      }),
    ).rejects.toBeDefined();
  });

  it("失敗系: deleteWidgetSite 5xx は throw", async () => {
    server.use(
      http.delete(`${API}/admin/widget-sites/x`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.deleteWidgetSite("x")).rejects.toBeDefined();
  });
});
