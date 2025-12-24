import type { FileInfo } from "~/types";

type Props = {
  files: FileInfo[];
  onEdit: (key: string) => void;
  onDelete: (key: string) => void;
  isDeleting: boolean;
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

export const FileList = ({ files, onEdit, onDelete, isDeleting }: Props) => {
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
              サイズ
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
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm font-medium text-stone-900">
                  {file.key}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-500">
                {formatFileSize(file.size)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-500">
                {formatDate(file.lastModified)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                <button
                  type="button"
                  onClick={() => onEdit(file.key)}
                  className="text-teal-600 hover:text-teal-800 font-medium mr-3"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(file.key)}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
