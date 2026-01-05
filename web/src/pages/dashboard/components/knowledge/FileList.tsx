import { getOriginalFileUrl } from "~/repository/knowledge-repository";
import type { UnifiedFileInfo } from "~/types";

type Props = {
  files: UnifiedFileInfo[];
  onEdit: (key: string) => void;
  onDelete: (baseName: string) => void;
  onReconvert: (originalKey: string, baseName: string) => void;
  isDeleting: boolean;
  isReconverting: boolean;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const isImageType = (contentType: string) => contentType.startsWith("image/");

export const FileList = ({
  files,
  onEdit,
  onDelete,
  onReconvert,
  isDeleting,
  isReconverting,
}: Props) => {
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-stone-500">
        ファイルがありません
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-stone-200">
        <thead className="bg-stone-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
              ファイル名
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
              元ファイル
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
              更新日時
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-stone-200">
          {files.map((file) => {
            const lastModified =
              file.markdown?.lastModified || file.original?.lastModified || "";

            return (
              <tr key={file.baseName} className="hover:bg-stone-50">
                {/* ファイル名 */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm font-medium text-stone-900">
                    {file.baseName}
                  </span>
                  {file.hasMarkdown ? (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-teal-100 text-teal-700 rounded">
                      同期済み
                    </span>
                  ) : (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-stone-100 text-stone-600 rounded">
                      未変換
                    </span>
                  )}
                </td>

                {/* 元ファイル */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {file.original ? (
                    <a
                      href={getOriginalFileUrl(file.original.key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 hover:underline"
                      title="元ファイルをダウンロード"
                    >
                      <span>
                        {isImageType(file.original.contentType) ? "🖼️" : "📄"}
                      </span>
                      <span>{formatFileSize(file.original.size)}</span>
                    </a>
                  ) : (
                    <span className="text-sm text-stone-400">-</span>
                  )}
                </td>

                {/* 更新日時 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-500">
                  {lastModified ? formatDate(lastModified) : "-"}
                </td>

                {/* 操作 */}
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                  <div className="flex justify-end gap-3">
                    {file.hasMarkdown ? (
                      <>
                        {(() => {
                          const orig = file.original;
                          if (!orig) return null;
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                onReconvert(orig.key, file.baseName)
                              }
                              disabled={isReconverting}
                              className={`text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50 ${
                                isReconverting ? "animate-pulse" : ""
                              }`}
                            >
                              {isReconverting ? "再変換中..." : "再変換"}
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() =>
                            file.markdown && onEdit(file.markdown.key)
                          }
                          className="text-teal-600 hover:text-teal-800 font-medium"
                        >
                          編集
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          file.original &&
                          onReconvert(file.original.key, file.baseName)
                        }
                        disabled={isReconverting}
                        className={`text-teal-600 hover:text-teal-800 font-medium disabled:opacity-50 ${
                          isReconverting ? "animate-pulse" : ""
                        }`}
                      >
                        {isReconverting ? "変換中..." : "変換"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(file.baseName)}
                      disabled={isDeleting}
                      className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
