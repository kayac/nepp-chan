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
});
