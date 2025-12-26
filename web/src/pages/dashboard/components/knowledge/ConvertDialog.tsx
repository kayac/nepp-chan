import { useState } from "react";

type Props = {
  file: File;
  onConvert: (filename: string) => void;
  onCancel: () => void;
  isConverting: boolean;
};

export const ConvertDialog = ({
  file,
  onConvert,
  onCancel,
  isConverting,
}: Props) => {
  // 元のファイル名から拡張子を除去してデフォルト名を生成
  const defaultName = file.name.replace(/\.[^/.]+$/, "");
  const [filename, setFilename] = useState(defaultName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filename.trim()) {
      onConvert(filename.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold text-stone-800 mb-4">
          ファイルを変換
        </h3>

        <div className="mb-4">
          <div className="text-sm text-stone-600 mb-2">
            <span className="font-medium">元ファイル:</span> {file.name}
          </div>
          <div className="text-sm text-stone-500">
            <span className="font-medium">形式:</span> {file.type}
          </div>
          <div className="text-sm text-stone-500">
            <span className="font-medium">サイズ:</span>{" "}
            {(file.size / 1024).toFixed(1)} KB
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="filename"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              保存するファイル名
            </label>
            <div className="flex items-center">
              <input
                type="text"
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                disabled={isConverting}
                className="flex-1 px-3 py-2 border border-stone-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-stone-100"
                placeholder="ファイル名を入力"
              />
              <span className="px-3 py-2 bg-stone-100 border border-l-0 border-stone-300 rounded-r-lg text-stone-500">
                .md
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isConverting}
              className="px-4 py-2 text-stone-600 hover:text-stone-800 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isConverting || !filename.trim()}
              className={`px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 disabled:cursor-not-allowed ${
                isConverting ? "animate-pulse" : "disabled:opacity-50"
              }`}
            >
              {isConverting ? "変換中..." : "変換して保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
