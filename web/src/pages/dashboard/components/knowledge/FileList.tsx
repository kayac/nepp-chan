import { formatDateTime } from "~/lib/format";
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
    <>
      {/* Desktop: Table View */}
      <div className="hidden md:block overflow-x-auto">
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
                file.markdown?.lastModified ||
                file.original?.lastModified ||
                "";

              return (
                <tr key={file.baseName} className="hover:bg-stone-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-stone-900">
                      {file.baseName}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const orig = file.original;
                      if (!orig) {
                        return (
                          <span className="text-sm text-stone-400">-</span>
                        );
                      }
                      return (
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
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-500">
                    {lastModified ? formatDateTime(lastModified) : "-"}
                  </td>
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

      {/* Mobile: Card View */}
      <div className="md:hidden space-y-3">
        {files.map((file) => {
          const lastModified =
            file.markdown?.lastModified || file.original?.lastModified || "";
          const orig = file.original;

          return (
            <div
              key={file.baseName}
              className="border border-stone-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-stone-900 break-all">
                  {file.baseName}
                </span>
                {orig && (
                  <a
                    href={getOriginalFileUrl(orig.key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 shrink-0"
                    title="元ファイルをダウンロード"
                  >
                    <span>{isImageType(orig.contentType) ? "🖼️" : "📄"}</span>
                    <span>{formatFileSize(orig.size)}</span>
                  </a>
                )}
              </div>

              {lastModified && (
                <div className="text-xs text-stone-500">
                  更新: {formatDateTime(lastModified)}
                </div>
              )}

              <div className="flex gap-4 pt-2 border-t border-stone-100">
                {file.hasMarkdown && onView && (
                  <button
                    type="button"
                    onClick={() => file.markdown && onView(file.markdown.key)}
                    className="text-sm text-teal-600 hover:text-teal-800 font-medium"
                  >
                    閲覧
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(file.baseName)}
                    disabled={isDeleting}
                    className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
