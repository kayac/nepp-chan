import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { knowledgeRepository } from "~/lib/api/repository";
import { renderWithQuery } from "~/test/query";
import { FileUpload } from "./FileUpload";

const mdFile = (name: string, webkitRelativePath = "") => {
  const file = new File(["# x"], name, { type: "text/markdown" });
  Object.defineProperty(file, "webkitRelativePath", {
    value: webkitRelativePath,
  });
  return file;
};

type Deferred = { resolve: () => void; reject: (e: Error) => void };

const spyUpload = () => vi.spyOn(knowledgeRepository, "uploadFile");

const dropZone = () =>
  screen.getByText("またはここにドラッグ&ドロップ")
    .parentElement as HTMLElement;

const fakeFileEntry = (fullPath: string) => ({
  isFile: true,
  isDirectory: false,
  fullPath,
  name: fullPath.split("/").pop(),
  file: (resolve: (file: File) => void) =>
    resolve(mdFile(fullPath.split("/").pop() ?? "")),
});

const fakeDirectoryEntry = (fullPath: string, children: unknown[]) => {
  const batches = [children, []];
  return {
    isFile: false,
    isDirectory: true,
    fullPath,
    name: fullPath.split("/").pop(),
    createReader: () => ({
      readEntries: (resolve: (entries: unknown[]) => void) =>
        resolve(batches.shift() ?? []),
    }),
  };
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FileUpload", () => {
  it("初期状態ではステータスを出さない", () => {
    renderWithQuery(<FileUpload />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("ファイル選択: .md だけを相対パス付きで送り、進捗の後に完了文言を出す", async () => {
    const pending = new Map<string, Deferred>();
    const upload = spyUpload().mockImplementation(
      (_file, filename) =>
        new Promise((resolve, reject) => {
          pending.set(filename, {
            resolve: () =>
              resolve({ key: `official/${filename}`, message: "" }),
            reject,
          });
        }),
    );
    renderWithQuery(<FileUpload />);

    fireEvent.change(screen.getByLabelText("ファイル"), {
      target: { files: [mdFile("a.md"), mdFile("memo.txt"), mdFile("b.md")] },
    });

    expect(await screen.findByText("0 / 2")).toBeDefined();
    expect(upload.mock.calls.map(([, filename]) => filename)).toEqual([
      "a.md",
      "b.md",
    ]);

    pending.get("a.md")?.resolve();
    expect(await screen.findByText("1 / 2")).toBeDefined();

    pending.get("b.md")?.resolve();
    expect(
      await screen.findByText(
        "2 件をアップロードしました。検索に反映されるまで数分かかります",
      ),
    ).toBeDefined();
  });

  it("フォルダ選択: 選んだフォルダを root にした相対パスで送る", async () => {
    const upload = spyUpload().mockResolvedValue({ key: "k", message: "" });
    renderWithQuery(<FileUpload />);

    fireEvent.change(screen.getByLabelText("フォルダ"), {
      target: {
        files: [
          mdFile("gomi.md", "knowledge/kurashi/gomi.md"),
          mdFile(".DS_Store", "knowledge/.DS_Store"),
        ],
      },
    });

    await screen.findByText(
      "1 件をアップロードしました。検索に反映されるまで数分かかります",
    );
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[1]).toBe("kurashi/gomi.md");
  });

  it("フォルダのドロップ: エントリを再帰的に読み、フォルダからの相対パスで送る", async () => {
    const upload = spyUpload().mockResolvedValue({ key: "k", message: "" });
    renderWithQuery(<FileUpload />);

    const tree = fakeDirectoryEntry("/knowledge", [
      fakeFileEntry("/knowledge/top.md"),
      fakeFileEntry("/knowledge/readme.txt"),
      fakeDirectoryEntry("/knowledge/kurashi", [
        fakeFileEntry("/knowledge/kurashi/gomi.md"),
      ]),
    ]);
    fireEvent.drop(dropZone(), {
      dataTransfer: {
        items: [
          { webkitGetAsEntry: () => tree },
          { webkitGetAsEntry: () => null },
        ],
        files: [],
      },
    });

    await screen.findByText(
      "2 件をアップロードしました。検索に反映されるまで数分かかります",
    );
    expect(upload.mock.calls.map(([, filename]) => filename)).toEqual([
      "top.md",
      "kurashi/gomi.md",
    ]);
  });

  it("エントリが取れないドロップは files にフォールバックする", async () => {
    const upload = spyUpload().mockResolvedValue({ key: "k", message: "" });
    renderWithQuery(<FileUpload />);

    fireEvent.drop(dropZone(), {
      dataTransfer: { files: [mdFile("plain.md")] },
    });

    await screen.findByText(
      "1 件をアップロードしました。検索に反映されるまで数分かかります",
    );
    expect(upload.mock.calls[0]?.[1]).toBe("plain.md");
  });

  it(".md が 1 件も無ければ何も起こらない", () => {
    const upload = spyUpload();
    renderWithQuery(<FileUpload />);

    fireEvent.change(screen.getByLabelText("ファイル"), {
      target: { files: [mdFile("memo.txt")] },
    });

    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("失敗分は一覧に出て、再試行で失敗した分だけを送り直す", async () => {
    let failOnce = true;
    const upload = spyUpload().mockImplementation(async (_file, filename) => {
      if (filename === "kanko/bad.md" && failOnce) {
        failOnce = false;
        throw new Error("boom");
      }
      return { key: `official/${filename}`, message: "" };
    });
    renderWithQuery(<FileUpload />);

    fireEvent.change(screen.getByLabelText("フォルダ"), {
      target: {
        files: [
          mdFile("a.md", "knowledge/a.md"),
          mdFile("bad.md", "knowledge/kanko/bad.md"),
        ],
      },
    });

    expect(
      await screen.findByText("1 件をアップロードしました。1 件が失敗しました"),
    ).toBeDefined();
    expect(screen.getByText("official/kanko/bad.md")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "失敗分を再試行" }));

    await screen.findByText(
      "1 件をアップロードしました。検索に反映されるまで数分かかります",
    );
    expect(upload.mock.calls.map(([, filename]) => filename)).toEqual([
      "a.md",
      "kanko/bad.md",
      "kanko/bad.md",
    ]);
    await waitFor(() =>
      expect(screen.queryByText("official/kanko/bad.md")).toBeNull(),
    );
  });
});
