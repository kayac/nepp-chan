import { formatDateTime } from "~/lib/format";
import type { FileInfo } from "~/types";
import { canDeleteFile, isCuratedFile, splitKey } from "./helpers";

type Props = {
  files: FileInfo[];
  onView: (key: string) => void;
  onEdit: (key: string) => void;
  onDelete: (key: string) => void;
  isDeleting?: boolean;
  emptyMessage?: string;
  loadMoreRef: (element: HTMLDivElement | null) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};

const ACTION_CLASS = "text-teal-600 hover:text-teal-800 font-medium";

const Actions = ({
  file,
  onView,
  onEdit,
  onDelete,
  isDeleting,
}: Pick<Props, "onView" | "onEdit" | "onDelete" | "isDeleting"> & {
  file: FileInfo;
}) => (
  <>
    <button
      type="button"
      onClick={() => onView(file.key)}
      className={ACTION_CLASS}
    >
      閲覧
    </button>
    {isCuratedFile(file) && (
      <button
        type="button"
        onClick={() => onEdit(file.key)}
        className={ACTION_CLASS}
      >
        編集
      </button>
    )}
    {canDeleteFile(file) && (
      <button
        type="button"
        onClick={() => onDelete(file.key)}
        disabled={isDeleting}
        className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
      >
        削除
      </button>
    )}
  </>
);

const FileName = ({ fileKey }: { fileKey: string }) => {
  const { dir, name } = splitKey(fileKey);
  return (
    <span className="font-mono text-sm break-all">
      <span className="text-stone-400">{dir}</span>
      <span className="text-stone-900">{name}</span>
    </span>
  );
};

export const FileList = ({
  files,
  onView,
  onEdit,
  onDelete,
  isDeleting,
  emptyMessage = "ファイルがありません",
  loadMoreRef,
  hasNextPage,
  isFetchingNextPage,
}: Props) => {
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-stone-500">{emptyMessage}</div>
    );
  }

  const actionProps = { onView, onEdit, onDelete, isDeleting };

  return (
    <div className="max-h-[70dvh] overflow-auto">
      <div className="hidden md:block">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-stone-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                ファイル
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
            {files.map((file) => (
              <tr key={file.key} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <FileName fileKey={file.key} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-500 tabular-nums">
                  {formatDateTime(file.lastModified)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                  <div className="flex justify-end gap-3">
                    <Actions file={file} {...actionProps} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {files.map((file) => (
          <div
            key={file.key}
            className="border border-stone-200 rounded-lg p-4 space-y-3"
          >
            <FileName fileKey={file.key} />
            <div className="text-xs text-stone-500">
              更新: {formatDateTime(file.lastModified)}
            </div>
            <div className="flex gap-4 pt-2 border-t border-stone-100 text-sm">
              <Actions file={file} {...actionProps} />
            </div>
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className="py-4 text-center text-sm">
        {isFetchingNextPage && (
          <span className="text-stone-500">読み込み中...</span>
        )}
        {!hasNextPage && (
          <span className="text-stone-400">すべてのファイルを表示しました</span>
        )}
      </div>
    </div>
  );
};
