import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@nepp-chan/shared/ui/Button";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import {
  type UploadFailure,
  type UploadItem,
  useUploadFiles,
} from "~/app/dashboard/hooks/useKnowledge";
import {
  collectMarkdownFiles,
  type EntryDeps,
  OFFICIAL_PREFIX,
  pickedFilesToCandidates,
  readAllEntries,
} from "./helpers";

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; done: number; total: number }
  | { kind: "done"; uploaded: number; failed: UploadFailure[] };

const entryDeps: EntryDeps = {
  readDirectory: (dir) => readAllEntries(dir.createReader()),
  readFile: (entry) =>
    new Promise((resolve, reject) => entry.file(resolve, reject)),
};

const entriesOf = (items: DataTransferItemList | undefined) =>
  Array.from(items ?? [])
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);

export const FileUpload = () => {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadFiles();
  const busy = status.kind === "uploading";

  const start = async (items: UploadItem[]) => {
    if (items.length === 0) return;
    setStatus({ kind: "uploading", done: 0, total: items.length });
    const outcome = await uploadMutation.mutateAsync({
      items,
      onProgress: (done) =>
        setStatus({ kind: "uploading", done, total: items.length }),
    });
    setStatus({ kind: "done", ...outcome });
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    void start(pickedFilesToCandidates(e.target.files ?? []));
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLFieldSetElement>) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const entries = entriesOf(e.dataTransfer.items);
    const files = e.dataTransfer.files;
    void (
      entries.length > 0
        ? collectMarkdownFiles(entries, entryDeps)
        : Promise.resolve(pickedFilesToCandidates(files))
    ).then(start);
  };

  return (
    <div className="space-y-4">
      <fieldset
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl px-6 py-8 text-center space-y-3 transition-colors ${
          dragging ? "border-teal-500 bg-teal-50" : "border-stone-300"
        }`}
      >
        <legend className="sr-only">公式資料のアップロード</legend>
        <ArrowUpTrayIcon
          className="mx-auto h-10 w-10 text-stone-400"
          aria-hidden="true"
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            onClick={() => directoryInputRef.current?.click()}
            disabled={busy}
          >
            フォルダを選択
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            ファイルを選択
          </Button>
        </div>
        <p className="text-sm text-stone-500">またはここにドラッグ&ドロップ</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md"
          onChange={onInputChange}
          className="hidden"
          aria-label="ファイル"
        />
        <input
          ref={directoryInputRef}
          type="file"
          {...{ webkitdirectory: "" }}
          onChange={onInputChange}
          className="hidden"
          aria-label="フォルダ"
        />
      </fieldset>

      {status.kind === "uploading" && (
        <output className="block px-4 py-3 rounded-lg bg-stone-100 text-sm text-stone-600">
          アップロード中...{" "}
          <span className="tabular-nums text-stone-900 font-medium">
            {status.done} / {status.total}
          </span>
        </output>
      )}

      {status.kind === "done" && status.failed.length === 0 && (
        <output className="block px-4 py-3 rounded-lg bg-green-50 text-sm text-green-700">
          {status.uploaded}{" "}
          件をアップロードしました。検索に反映されるまで数分かかります
        </output>
      )}

      {status.kind === "done" && status.failed.length > 0 && (
        <output className="block px-4 py-3 rounded-lg bg-amber-50 text-sm text-amber-800 space-y-2">
          <p>
            {status.uploaded} 件をアップロードしました。{status.failed.length}{" "}
            件が失敗しました
          </p>
          <ul className="list-disc pl-5 font-mono text-xs text-stone-800">
            {status.failed.map((failure) => (
              <li key={failure.relativePath}>
                {OFFICIAL_PREFIX}
                {failure.relativePath}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => start(status.failed)}
          >
            失敗分を再試行
          </Button>
        </output>
      )}
    </div>
  );
};
