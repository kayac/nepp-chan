import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { CuratedComposer } from "./CuratedComposer";

const API = "http://localhost:8787";

const draft = {
  key: "curated/otoineppu-tokyo.md",
  content:
    "---\ntitle: 音威子府TOKYO\ncategory: お店・スポット\n---\n# 音威子府TOKYO\n\n> 注意書き\n\n生成された本文\n",
  readUrls: ["https://peraichi.com/landing_pages/view/otoineppu"],
  unreadable: [
    {
      name: "https://www.instagram.com/usagi/",
      reason: "ログインページに転送されました",
    },
  ],
};

const OVERWRITE_WARNING = "同名のファイルがあります。保存すると上書きされます";

const openText = () => {
  fireEvent.click(screen.getByRole("tab", { name: "文章から作る" }));
  return screen.getByLabelText("文章") as HTMLTextAreaElement;
};
const openFiles = () =>
  fireEvent.click(screen.getByRole("tab", { name: "画像・PDF から作る" }));
const urlInput = () => screen.getByRole("textbox", { name: "URL" });
const addUrl = (url: string) => {
  fireEvent.change(urlInput(), { target: { value: url } });
  fireEvent.keyDown(urlInput(), { key: "Enter" });
};
const generateButton = () =>
  screen.getByRole("button", {
    name: /下書きを作る|下書きを作り直す|読み取り中/,
  });
const saveButton = () =>
  screen.getByRole("button", { name: /^(保存|上書きして保存|保存中...)$/ });
const titleInput = () => screen.getByLabelText("タイトル") as HTMLInputElement;

const captureRequest = () => {
  const captured: { urls: string[]; text: string | null } = {
    urls: [],
    text: null,
  };
  server.use(
    http.post(`${API}/admin/knowledge/curated-draft`, async ({ request }) => {
      const form = await request.formData();
      captured.urls = form.getAll("urls").map(String);
      captured.text = form.get("text") as string | null;
      return HttpResponse.json(draft);
    }),
  );
  return captured;
};

const renderComposer = (existingKeys: string[] = []) =>
  renderWithQuery(<CuratedComposer existingKeys={existingKeys} />);

const generateFrom = async (text: string) => {
  fireEvent.change(openText(), { target: { value: text } });
  fireEvent.click(generateButton());
  await waitFor(() => expect(titleInput().value).toBe("音威子府TOKYO"));
};

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("CuratedComposer", () => {
  it("最初は URL タブが選ばれ、文章と画像の入力はタブを切り替えると出る", () => {
    renderComposer();

    expect(screen.getByRole("tab", { name: "URL から作る" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(urlInput()).toBeDefined();
    expect(generateButton()).toBeDisabled();
    expect(screen.queryByLabelText("文章")).toBeNull();
    expect(screen.queryByLabelText("タイトル")).toBeNull();

    openText();
    expect(screen.getByLabelText("文章")).toBeDefined();
    expect(
      screen.queryAllByRole("textbox", { name: /^URL \d+$/ }),
    ).toHaveLength(0);

    openFiles();
    expect(
      screen.getByRole("button", { name: /ドロップ、またはクリックして選ぶ/ }),
    ).toBeDefined();
  });

  it("生成に使うのは表示中のタブの入力だけ", async () => {
    const captured = captureRequest();
    renderComposer();
    addUrl("https://peraichi.com/x");
    fireEvent.change(openText(), { target: { value: "メモ" } });

    fireEvent.click(generateButton());
    await waitFor(() => expect(titleInput().value).toBe("音威子府TOKYO"));

    expect(captured.urls).toEqual([]);
    expect(captured.text).toBe("メモ");
  });

  it("URL は Enter か貼り付けでチップになり、× で外せて、そのまま生成できる", async () => {
    const captured = captureRequest();
    renderComposer();

    addUrl("https://peraichi.com/x");
    fireEvent.paste(urlInput(), {
      clipboardData: { getData: () => "https://a.example/ https://b.example/" },
    });
    expect(screen.getByText("peraichi.com/x")).toBeDefined();
    expect(screen.getByText("a.example")).toBeDefined();
    expect(screen.getByText("b.example")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "b.example を外す" }));
    expect(screen.queryByText("b.example")).toBeNull();

    expect(generateButton()).toBeEnabled();
    fireEvent.click(generateButton());
    await waitFor(() => expect(titleInput().value).toBe("音威子府TOKYO"));

    expect(captured.urls).toEqual([
      "https://peraichi.com/x",
      "https://a.example/",
    ]);
    expect(captured.text).toBeNull();
  });

  it("URL でない文字列は赤く警告してチップにしない", () => {
    renderComposer();

    addUrl("音威子府");

    expect(
      screen.getByText("http:// か https:// で始まる URL を入力してください"),
    ).toBeDefined();
    expect(generateButton()).toBeDisabled();
  });

  it("入力途中で Enter を押していない URL も生成に使う", async () => {
    const captured = captureRequest();
    renderComposer();
    fireEvent.change(urlInput(), {
      target: { value: "https://peraichi.com/x" },
    });

    fireEvent.click(generateButton());
    await waitFor(() => expect(titleInput().value).toBe("音威子府TOKYO"));

    expect(captured.urls).toEqual(["https://peraichi.com/x"]);
  });

  it("文章の中に URL が混ざっていても URL として拾う", async () => {
    const captured = captureRequest();
    renderComposer();

    await generateFrom("音威子府TOKYO の店 https://peraichi.com/x を追加");

    expect(captured.urls).toEqual(["https://peraichi.com/x"]);
    expect(captured.text).toBe(
      "音威子府TOKYO の店 https://peraichi.com/x を追加",
    );
  });

  it("生成後はタイトル欄と整形された本文が出て、Markdown 記法や frontmatter は見せない", async () => {
    captureRequest();
    renderComposer();

    await generateFrom("メモ");

    expect(screen.getByText("生成された本文")).toBeDefined();
    expect(screen.queryByText(/title:/)).toBeNull();
    expect(screen.queryByText(/^# /)).toBeNull();
    expect(screen.getByText("curated/otoineppu-tokyo.md")).toBeDefined();
    expect(generateButton()).toHaveTextContent("下書きを作り直す");
  });

  it("参照した資料はリンクで開け、読み取れなかった資料は理由付きで出る", async () => {
    captureRequest();
    renderComposer();

    await generateFrom("メモ");

    const link = screen.getByRole("link", {
      name: "peraichi.com/landing_pages/view/otoineppu",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://peraichi.com/landing_pages/view/otoineppu",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(
      screen.getByText(
        /instagram\.com\/usagi\/（ログインページに転送されました）/,
      ),
    ).toBeDefined();
  });

  it("「編集」で本文を文章として直せ、タイトル変更は frontmatter と見出しの両方に入って保存される", async () => {
    let putBody: { content: string } | null = null;
    captureRequest();
    server.use(
      http.put(`${API}/admin/knowledge/files/*`, async ({ request }) => {
        putBody = (await request.json()) as { content: string };
        return HttpResponse.json({ message: "ok", chunks: 3 });
      }),
    );
    renderComposer();
    await generateFrom("メモ");

    fireEvent.change(titleInput(), {
      target: { value: "音威子府TOKYO（四谷）" },
    });
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    fireEvent.change(screen.getByLabelText("本文"), {
      target: { value: "直した本文\n" },
    });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(putBody).toEqual({
        content:
          "---\ntitle: 音威子府TOKYO（四谷）\ncategory: お店・スポット\n---\n# 音威子府TOKYO（四谷）\n\n直した本文\n",
      }),
    );
  });

  it("作り直すと前の下書きに戻せる", async () => {
    captureRequest();
    renderComposer();
    await generateFrom("メモ");
    fireEvent.change(titleInput(), { target: { value: "手で直した" } });

    fireEvent.click(generateButton());
    await waitFor(() => expect(titleInput().value).toBe("音威子府TOKYO"));

    fireEvent.click(screen.getByRole("button", { name: "前の下書きに戻す" }));
    expect(titleInput().value).toBe("手で直した");
  });

  it("422 のときはサーバーの案内文を表示し、下書きは出ない", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/curated-draft`, () =>
        HttpResponse.json(
          {
            error: {
              code: 422,
              message: "どの資料からも本文を取得できませんでした",
            },
          },
          { status: 422 },
        ),
      ),
    );
    renderComposer();
    addUrl("https://www.instagram.com/usagi/");

    fireEvent.click(generateButton());

    expect(
      await screen.findByText(
        "エラー: どの資料からも本文を取得できませんでした",
      ),
    ).toBeDefined();
    expect(screen.queryByLabelText("タイトル")).toBeNull();
  });

  it("画像はファイル選択でもドロップ領域への貼り付けでも追加でき、削除できる", () => {
    renderComposer();
    openFiles();
    fireEvent.change(screen.getByLabelText("画像・PDF"), {
      target: { files: [new File(["x"], "flyer.png", { type: "image/png" })] },
    });
    fireEvent.paste(
      screen.getByRole("button", { name: /ドロップ、またはクリックして選ぶ/ }),
      {
        clipboardData: {
          files: [new File(["y"], "shot.png", { type: "image/png" })],
          getData: () => "",
        },
      },
    );

    expect(screen.getByText("flyer.png")).toBeDefined();
    expect(screen.getByText("shot.png")).toBeDefined();
    expect(generateButton()).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "flyer.png を削除" }));
    fireEvent.click(screen.getByRole("button", { name: "shot.png を削除" }));
    expect(generateButton()).toBeDisabled();
  });

  it("保存先は自動で決まり、「変更」で編集でき、既存キーなら上書き警告、/ は不可", async () => {
    captureRequest();
    renderComposer(["curated/otoineppu-tokyo.md"]);
    await generateFrom("メモ");

    expect(screen.getByText(OVERWRITE_WARNING)).toBeDefined();
    expect(saveButton()).toHaveTextContent("上書きして保存");

    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    fireEvent.change(screen.getByLabelText("保存先"), {
      target: { value: "otoineppu-tokyo-2" },
    });
    expect(screen.queryByText(OVERWRITE_WARNING)).toBeNull();
    expect(saveButton()).toBeEnabled();

    fireEvent.change(screen.getByLabelText("保存先"), {
      target: { value: "a/b" },
    });
    expect(screen.getByText("保存先に / は使えません")).toBeDefined();
    expect(saveButton()).toBeDisabled();
  });

  it("保存すると入力箱の上に完了メッセージが出て、最初の状態に戻る", async () => {
    let putUrl = "";
    captureRequest();
    server.use(
      http.put(`${API}/admin/knowledge/files/*`, ({ request }) => {
        putUrl = request.url;
        return HttpResponse.json({ message: "ok", chunks: 3 });
      }),
    );
    renderComposer();
    await generateFrom("メモ");

    fireEvent.click(saveButton());

    expect(
      await screen.findByText(
        "curated/otoineppu-tokyo.md を保存しました（3 チャンクを同期）",
      ),
    ).toBeDefined();
    expect(decodeURIComponent(putUrl)).toContain(
      "/files/curated/otoineppu-tokyo.md",
    );
    expect(screen.queryByLabelText("タイトル")).toBeNull();
    expect(screen.getByRole("tab", { name: "URL から作る" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect((urlInput() as HTMLInputElement).value).toBe("");
  });
});
