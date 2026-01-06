import { getOriginalFileUrl } from "~/repository/knowledge-repository";
import type { UnifiedFileInfo } from "~/types";

/**
 * NOTE: onEdit, onReconvert は運用時に復活させる
 * 現在は閲覧・削除のみ可能
 */
type Props = {
  files: UnifiedFileInfo[];
  onView?: (key: string) => void;
  onDelete?: (baseName: string) => void;
  isDeleting?: boolean;
  // TODO: 運用時に復活
  // onEdit: (key: string) => void;
  // onReconvert: (originalKey: string, baseName: string) => void;
  // isReconverting: boolean;
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
  onView,
  onDelete,
  isDeleting,
  // TODO: 運用時に復活
  // onEdit,
  // onReconvert,
  // isReconverting,
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
                </td>

                {/* 元ファイル */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {(() => {
                    const orig = file.original;
                    if (!orig) {
                      return <span className="text-sm text-stone-400">-</span>;
                    }
                    return (
                      <div className="flex items-center gap-2">
                        <a
                          href={getOriginalFileUrl(orig.key)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 hover:underline"
                          title="元ファイルをダウンロード"
                        >
                          <span>
                            {isImageType(orig.contentType) ? "🖼️" : "📄"}
                          </span>
                          <span>{formatFileSize(orig.size)}</span>
                        </a>
                        {/* TODO: 運用時に復活 - 再生成ボタン */}
                        {/* <button
                          type="button"
                          onClick={() => onReconvert(orig.key, file.baseName)}
                          disabled={isReconverting}
                          className={`text-xs px-2 py-0.5 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-50 ${
                            isReconverting ? "animate-pulse" : ""
                          }`}
                          title="元ファイルからMarkdownを再生成"
                        >
                          {isReconverting ? "生成中..." : "再生成"}
                        </button> */}
                      </div>
                    );
                  })()}
                </td>

                {/* 更新日時 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-500">
                  {lastModified ? formatDate(lastModified) : "-"}
                </td>

                {/* 操作 */}
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                  <div className="flex justify-end gap-3">
                    {file.hasMarkdown && onView && (
                      <button
                        type="button"
                        onClick={() =>
                          file.markdown && onView(file.markdown.key)
                        }
                        className="text-teal-600 hover:text-teal-800 font-medium"
                      >
                        閲覧
                      </button>
                    )}
                    {/* TODO: 運用時に復活 - 編集ボタン */}
                    {/* {file.hasMarkdown && (
                      <button
                        type="button"
                        onClick={() =>
                          file.markdown && onEdit(file.markdown.key)
                        }
                        className="text-teal-600 hover:text-teal-800 font-medium"
                      >
                        編集
                      </button>
                    )} */}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(file.baseName)}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        削除
                      </button>
                    )}
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
