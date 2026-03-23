import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";
import { useConvertFile, useUploadFile } from "~/hooks/useDashboard";
import { ConvertDialog } from "./ConvertDialog";

type Props = {
  onSuccess: () => void;
};

const ACCEPT_TYPES = ".md,.txt,.jpg,.jpeg,.png,.webp,.gif,.pdf";
const IMAGE_PDF_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export const FileUpload = ({ onSuccess }: Props) => {
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [convertFile, setConvertFile] = useState<File | null>(null);

  const uploadMutation = useUploadFile();
  const convertMutation = useConvertFile();

  const handleFile = useCallback(
    (file: File) => {
      setMessage(null);

      // 画像/PDF の場合は変換ダイアログを表示
      if (IMAGE_PDF_TYPES.includes(file.type)) {
        setConvertFile(file);
        return;
      }

      // Markdown/テキストの場合は直接アップロード
      uploadMutation.mutate(
        { file },
        {
          onSuccess: (result) => {
            setMessage({
              type: "success",
              text: `${result.key} をアップロードしました（${result.chunks} チャンク）`,
            });
            onSuccess();
          },
          onError: (err) => {
            setMessage({
              type: "error",
              text:
                err instanceof Error
                  ? err.message
                  : "アップロードに失敗しました",
            });
          },
        },
      );
    },
    [uploadMutation, onSuccess],
  );

  const handleConvert = async (filename: string) => {
    if (!convertFile) return;

    try {
      const result = await convertMutation.mutateAsync({
        file: convertFile,
        filename,
      });
      setMessage({
        type: "success",
        text: `${result.key} に変換しました（${result.chunks} チャンク）`,
      });
      setConvertFile(null);
      onSuccess();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "変換に失敗しました",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = "";
  };

  const isLoading = uploadMutation.isPending || convertMutation.isPending;

  return (
    <div className="space-y-4">
      {/* ドラッグ&ドロップ領域 */}
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`block border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-teal-500 bg-teal-50"
            : "border-stone-300 hover:border-stone-400"
        }`}
      >
        <div className="space-y-2">
          <ArrowUpTrayIcon
            className="mx-auto h-12 w-12 text-stone-400"
            aria-hidden="true"
          />
          <div className="text-sm text-stone-600">
            <span className="text-teal-600 hover:text-teal-700 font-medium">
              ファイルを選択
            </span>
            <span className="pl-1">またはドラッグ&ドロップ</span>
          </div>
          <p className="text-xs text-stone-500">
            Markdown, テキスト, 画像 (PNG, JPEG, WebP, GIF), PDF
          </p>
          <input
            type="file"
            className="sr-only"
            accept={ACCEPT_TYPES}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </div>
      </label>

      {/* ローディング */}
      {isLoading && (
        <div className="text-center text-sm text-stone-500">
          {convertMutation.isPending ? "変換中..." : "アップロード中..."}
        </div>
      )}

      {/* メッセージ */}
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 変換ダイアログ */}
      {convertFile && (
        <ConvertDialog
          file={convertFile}
          onConvert={handleConvert}
          onCancel={() => setConvertFile(null)}
          isConverting={convertMutation.isPending}
        />
      )}
    </div>
  );
};
