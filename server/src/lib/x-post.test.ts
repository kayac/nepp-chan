import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchXPostText, isXPostUrl } from "./x-post";

describe("isXPostUrl", () => {
  it.each([
    "https://x.com/jack/status/20",
    "https://twitter.com/jack/status/20?s=20",
    "https://mobile.twitter.com/jack/status/20",
  ])("%s は個別投稿", (url) => {
    expect(isXPostUrl(url)).toBe(true);
  });

  it.each([
    "https://x.com/jack",
    "https://x.com/i/lists/1",
    "https://example.com/jack/status/20",
    "not a url",
  ])("%s は個別投稿ではない", (url) => {
    expect(isXPostUrl(url)).toBe(false);
  });
});

describe("fetchXPostText", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("oEmbed の html を本文テキストにして author_name と返す", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          author_name: "jack",
          html: '<blockquote class="twitter-tweet"><p lang="en">just setting up my twttr</p>&mdash; jack (@jack) <a href="https://x.com/jack/status/20">2006年3月21日</a></blockquote>\n\n',
        }),
        { status: 200 },
      ),
    );

    const post = await fetchXPostText("https://x.com/jack/status/20");

    expect(post.authorName).toBe("jack");
    expect(post.text).toBe(
      "just setting up my twttr\n— jack (@jack) 2006年3月21日",
    );
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("publish.x.com/oembed");
    expect(calledUrl).toContain(
      encodeURIComponent("https://x.com/jack/status/20"),
    );
  });

  it("非 2xx は HTTP ステータス付きで throw する", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 404 }));

    await expect(fetchXPostText("https://x.com/jack/status/1")).rejects.toThrow(
      "HTTP 404",
    );
  });
});
