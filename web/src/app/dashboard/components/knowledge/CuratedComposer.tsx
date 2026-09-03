import {
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  DocumentIcon,
  LinkIcon,
  PencilSquareIcon,
  PhotoIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CURATED_DRAFT_LIMITS } from "@nepp-chan/shared/constants/knowledge";
import { Button } from "@nepp-chan/shared/ui/Button";
import { Spinner } from "@nepp-chan/shared/ui/Loading";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useDraftCurated,
  useSaveFile,
} from "~/app/dashboard/hooks/useKnowledge";
import { MarkdownText } from "~/components/chat/MarkdownText";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import type { CuratedDraft } from "~/types";
import {
  addUrls,
  CURATED_PREFIX,
  DRAFT_FILE_ACCEPT,
  type DraftParts,
  extractUrls,
  hasDraftInput,
  hostLabel,
  INPUT_CLASS,
  isValidSlug,
  joinDraft,
  keyFromSlug,
  type SourceKind,
  slugFromKey,
  splitDraft,
  toDraftRequest,
} from "./helpers";

type Props = {
  existingKeys: string[];
};

const SOURCE_TABS = [
  { kind: "url", label: "URL から作る", icon: LinkIcon },
  { kind: "text", label: "文章から作る", icon: PencilSquareIcon },
  { kind: "files", label: "画像・PDF から作る", icon: PhotoIcon },
] as const;

const isImage = (file: File) => file.type.startsWith("image/");

const FileThumb = ({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage(file) || typeof URL.createObjectURL !== "function") return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <li className="relative">
      <div
        className="w-14 h-14 rounded-lg border border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center"
        title={file.name}
      >
        {url ? (
          <img
            src={url}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <DocumentIcon className="w-6 h-6 text-stone-400" aria-hidden="true" />
        )}
      </div>
      <span className="block w-14 mt-1 text-[11px] text-stone-500 truncate">
        {file.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${file.name} を削除`}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-stone-300 text-stone-500 hover:text-stone-800 flex items-center justify-center shadow-sm"
      >
        <XMarkIcon className="w-3 h-3" aria-hidden="true" />
      </button>
    </li>
  );
};

export const CuratedComposer = ({ existingKeys }: Props) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [kind, setKind] = useState<SourceKind>("url");
  const [slug, setSlug] = useState("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [draft, setDraft] = useState<DraftParts | null>(null);
  const [previousDraft, setPreviousDraft] = useState<DraftParts | null>(null);
  const [editingBody, setEditingBody] = useState(false);
  const [lastResult, setLastResult] = useState<CuratedDraft | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftMutation = useDraftCurated();
  const saveMutation = useSaveFile();

  const fields = {
    kind,
    urls: [...urls, ...extractUrls(urlInput)],
    text,
    files,
  };
  const busy = draftMutation.isPending || saveMutation.isPending;
  const canGenerate = hasDraftInput(fields) && !busy;
  const key = keyFromSlug(slug);
  const exists = slug.trim().length > 0 && existingKeys.includes(key);
  const canSave =
    draft !== null &&
    isValidSlug(slug) &&
    draft.title.trim().length > 0 &&
    draft.body.trim().length > 0 &&
    !busy;

  const commitUrl = (input: string) => {
    if (!input.trim()) return;
    const result = addUrls(urls, input, CURATED_DRAFT_LIMITS.urls);
    setUrls(result.urls);
    setUrlInput(result.accepted ? "" : input);
    setUrlError(!result.accepted);
  };
  const onUrlKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commitUrl(urlInput);
    } else if (e.key === "Backspace" && !urlInput && urls.length > 0) {
      setUrls((prev) => prev.slice(0, -1));
    }
  };
  const onUrlPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!extractUrls(pasted).length) return;
    e.preventDefault();
    commitUrl(`${urlInput} ${pasted}`);
  };
  const removeUrl = (url: string) =>
    setUrls((prev) => prev.filter((u) => u !== url));

  const addFiles = (picked: FileList | File[] | null) => {
    if (!picked) return;
    setFiles((prev) =>
      [...prev, ...Array.from(picked)].slice(0, CURATED_DRAFT_LIMITS.files),
    );
  };
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };
  const onPaste = (e: ClipboardEvent<HTMLElement>) => {
    const pasted = Array.from(e.clipboardData?.files ?? []);
    if (pasted.length === 0) return;
    e.preventDefault();
    addFiles(pasted);
  };
  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };
  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const generate = () => {
    setSavedMessage(null);
    draftMutation.mutate(toDraftRequest(fields), {
      onSuccess: (result) => {
        setPreviousDraft(draft);
        setDraft(splitDraft(result.content));
        setEditingBody(false);
        setLastResult(result);
        if (!slug.trim()) setSlug(slugFromKey(result.key));
      },
    });
  };

  const undo = () => {
    setDraft(previousDraft);
    setPreviousDraft(null);
  };

  const save = () => {
    if (!draft) return;
    saveMutation.mutate(
      { key, content: joinDraft(draft) },
      {
        onSuccess: (result) => {
          setSavedMessage(
            `${key} を保存しました（${result.chunks} チャンクを同期）`,
          );
          setUrls([]);
          setUrlInput("");
          setUrlError(false);
          setText("");
          setFiles([]);
          setKind("url");
          setSlug("");
          setEditingSlug(false);
          setDraft(null);
          setPreviousDraft(null);
          setEditingBody(false);
          setLastResult(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {savedMessage && (
        <output className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">
          <CheckCircleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
          {savedMessage}
        </output>
      )}

      <section className="space-y-3">
        <div
          role="tablist"
          aria-label="情報源の種類"
          className="flex flex-wrap gap-2"
        >
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              role="tab"
              aria-selected={kind === tab.kind}
              onClick={() => setKind(tab.kind)}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                kind === tab.kind
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {kind === "url" && (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">
              ページを読み取って、その内容から下書きを作ります
            </p>
            <div
              className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border bg-white ${
                urlError ? "border-red-400" : "border-stone-300"
              } focus-within:ring-2 focus-within:ring-teal-500`}
            >
              {urls.map((url) => (
                <span
                  key={url}
                  className="inline-flex items-center gap-1 max-w-full pl-2 pr-1 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-900 text-sm"
                >
                  <LinkIcon
                    className="w-3.5 h-3.5 shrink-0 text-teal-600"
                    aria-hidden="true"
                  />
                  <span className="truncate" title={url}>
                    {hostLabel(url)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUrl(url)}
                    disabled={busy}
                    aria-label={`${hostLabel(url)} を外す`}
                    className="p-0.5 rounded-full text-teal-700 hover:bg-teal-100"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {urls.length < CURATED_DRAFT_LIMITS.urls && (
                <input
                  type="text"
                  aria-label="URL"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setUrlError(false);
                  }}
                  onKeyDown={onUrlKeyDown}
                  onPaste={onUrlPaste}
                  onBlur={() => commitUrl(urlInput)}
                  disabled={busy}
                  placeholder={
                    urls.length === 0
                      ? "URL を貼り付け（複数可）"
                      : "続けて貼り付け"
                  }
                  className="flex-1 min-w-[200px] py-1 text-sm bg-transparent border-0 focus:outline-none disabled:text-stone-400"
                />
              )}
            </div>
            <p
              className={`text-xs ${urlError ? "text-red-600" : "text-stone-500"}`}
            >
              {urlError
                ? "http:// か https:// で始まる URL を入力してください"
                : `貼り付けるとすぐ追加されます。続けて貼れば複数のページを読みます（最大 ${CURATED_DRAFT_LIMITS.urls} 件）`}
            </p>
          </div>
        )}

        {kind === "text" && (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">
              知っている内容や SNS
              の投稿文を、そのまま貼り付けてください。文中の URL も読み取ります
            </p>
            <textarea
              aria-label="文章"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              rows={6}
              placeholder="例: 音威子府村に開業準備中の食事処。アスパラ農家が営む店で…"
              className={`${INPUT_CLASS} resize-y`}
            />
          </div>
        )}

        {kind === "files" && (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">
              チラシや写真、PDF の文字を読み取って下書きを作ります
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onPaste={onPaste}
                disabled={busy || files.length >= CURATED_DRAFT_LIMITS.files}
                className={`min-w-[240px] min-h-[96px] flex flex-col items-center justify-center gap-1 px-6 rounded-lg border-2 border-dashed text-sm transition-colors disabled:opacity-50 ${
                  dragging
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-stone-300 text-stone-600 hover:border-teal-400 hover:text-teal-700"
                }`}
              >
                <PhotoIcon className="w-6 h-6" aria-hidden="true" />
                ここにドロップ、またはクリックして選ぶ
              </button>
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-3">
                  {files.map((file, index) => (
                    <FileThumb
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      file={file}
                      onRemove={() => removeFile(index)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={DRAFT_FILE_ACCEPT}
          onChange={onFileChange}
          className="hidden"
          aria-label="画像・PDF"
        />
      </section>

      <div className="flex items-center justify-end gap-3">
        {draftMutation.isPending && (
          <span className="flex items-center gap-2 text-sm text-stone-500">
            <Spinner size="sm" />
            読み取り中。1 分ほどかかることがあります
          </span>
        )}
        <Button type="button" onClick={generate} disabled={!canGenerate}>
          <SparklesIcon className="w-4 h-4" aria-hidden="true" />
          {draftMutation.isPending
            ? "読み取り中..."
            : draft === null
              ? "下書きを作る"
              : "下書きを作り直す"}
        </Button>
      </div>

      {draftMutation.isError && (
        <ErrorBanner>{formatError(draftMutation.error)}</ErrorBanner>
      )}

      {draft && (
        <section className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-3">
          <h3 className="text-sm font-bold text-stone-800">
            下書きを確認して保存
          </h3>

          {lastResult &&
            (lastResult.readUrls.length > 0 ||
              lastResult.unreadable.length > 0) && (
              <div className="text-xs text-stone-600 space-y-1">
                {lastResult.readUrls.length > 0 && (
                  <p className="flex flex-wrap gap-x-2">
                    <span className="font-medium">参照した資料:</span>
                    {lastResult.readUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-700 hover:underline break-all"
                      >
                        {hostLabel(url)}
                      </a>
                    ))}
                  </p>
                )}
                {lastResult.unreadable.length > 0 && (
                  <p className="text-amber-700">
                    <span className="font-medium">読み取れなかった資料:</span>{" "}
                    {lastResult.unreadable
                      .map((u) => `${hostLabel(u.name)}（${u.reason}）`)
                      .join(" / ")}
                  </p>
                )}
              </div>
            )}

          <div>
            <label
              htmlFor="curated-title"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              タイトル
            </label>
            <input
              id="curated-title"
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              disabled={busy}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-stone-700">本文</span>
              <button
                type="button"
                onClick={() => setEditingBody((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"
              >
                <PencilSquareIcon className="w-4 h-4" aria-hidden="true" />
                {editingBody ? "表示に戻す" : "編集"}
              </button>
            </div>
            {editingBody ? (
              <textarea
                aria-label="本文"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                disabled={busy}
                className={`${INPUT_CLASS} min-h-[320px] p-3 resize-y leading-relaxed`}
              />
            ) : (
              <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 leading-relaxed [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm">
                <MarkdownText text={draft.body} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
            <span>保存先</span>
            {editingSlug ? (
              <span className="flex items-center">
                <span className="px-2 py-1 bg-stone-100 border border-r-0 border-stone-300 rounded-l-lg text-stone-500">
                  {CURATED_PREFIX}
                </span>
                <input
                  aria-label="保存先"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={busy}
                  className="px-2 py-1 border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <span className="px-2 py-1 bg-stone-100 border border-l-0 border-stone-300 rounded-r-lg text-stone-500">
                  .md
                </span>
              </span>
            ) : (
              <>
                <code className="text-stone-800">{key}</code>
                <button
                  type="button"
                  onClick={() => setEditingSlug(true)}
                  className="text-teal-700 hover:underline"
                >
                  変更
                </button>
              </>
            )}
          </div>
          {exists && (
            <p className="text-sm text-amber-700">
              同名のファイルがあります。保存すると上書きされます
            </p>
          )}
          {slug.trim() && !isValidSlug(slug) && (
            <p className="text-sm text-red-600">保存先に / は使えません</p>
          )}

          {saveMutation.isError && (
            <ErrorBanner>{formatError(saveMutation.error)}</ErrorBanner>
          )}

          <div className="flex justify-end gap-2">
            {previousDraft !== null && (
              <Button
                type="button"
                variant="ghost"
                onClick={undo}
                disabled={busy}
              >
                <ArrowUturnLeftIcon className="w-4 h-4" aria-hidden="true" />
                前の下書きに戻す
              </Button>
            )}
            <Button type="button" onClick={save} disabled={!canSave}>
              {saveMutation.isPending
                ? "保存中..."
                : exists
                  ? "上書きして保存"
                  : "保存"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
