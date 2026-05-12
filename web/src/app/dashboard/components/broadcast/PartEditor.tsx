import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars3BottomLeftIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useRef } from "react";

import { getImageUrl, type PartState } from "./helpers";

type Props = {
  part: PartState;
  index: number;
  total: number;
  onChange: (index: number, part: PartState) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
};

export const PartEditor = ({
  part,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent =
    part.type === "text"
      ? part.text.trim().length > 0
      : !!(part.imageR2Key || part.file);
  const canSwitchToText = part.type === "text" || !hasContent;
  const canSwitchToImage = part.type === "image" || !hasContent;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onChange(index, {
      id: part.id,
      type: "image",
      imageR2Key: "",
      file,
      previewUrl,
    });
  };

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-stone-50 px-2 py-1.5">
        <div className="flex">
          <button
            type="button"
            disabled={!canSwitchToText}
            onClick={() =>
              part.type !== "text" &&
              onChange(index, { id: part.id, type: "text", text: "" })
            }
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-l border transition-colors ${
              part.type === "text"
                ? "bg-white text-stone-800 border-stone-300"
                : canSwitchToText
                  ? "bg-stone-100 text-stone-400 border-stone-200 hover:text-stone-600"
                  : "bg-stone-100 text-stone-300 border-stone-200 cursor-not-allowed"
            }`}
          >
            <Bars3BottomLeftIcon className="w-3.5 h-3.5" />
            テキスト
          </button>
          <button
            type="button"
            disabled={!canSwitchToImage}
            onClick={() =>
              part.type !== "image" &&
              onChange(index, {
                id: part.id,
                type: "image",
                imageR2Key: "",
              })
            }
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-r border border-l-0 transition-colors ${
              part.type === "image"
                ? "bg-white text-stone-800 border-stone-300"
                : canSwitchToImage
                  ? "bg-stone-100 text-stone-400 border-stone-200 hover:text-stone-600"
                  : "bg-stone-100 text-stone-300 border-stone-200 cursor-not-allowed"
            }`}
          >
            <PhotoIcon className="w-3.5 h-3.5" />
            画像
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(index, "up")}
            disabled={index === 0}
            className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"
          >
            <ArrowUpIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, "down")}
            disabled={index === total - 1}
            className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"
          >
            <ArrowDownIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={total <= 1}
            className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        {part.type === "text" ? (
          <div>
            <textarea
              value={part.text}
              onChange={(e) =>
                onChange(index, {
                  id: part.id,
                  type: "text",
                  text: e.target.value,
                })
              }
              placeholder="テキストを入力"
              maxLength={5000}
              rows={4}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
            />
            <div className="text-xs text-stone-400 mt-1 text-right">
              {part.text.length} / 5000
            </div>
          </div>
        ) : (
          <div>
            {part.previewUrl || part.imageR2Key ? (
              <div className="relative">
                <img
                  src={part.previewUrl || getImageUrl(part.imageR2Key)}
                  alt="プレビュー"
                  className="max-h-48 rounded-lg object-contain mx-auto"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange(index, {
                      id: part.id,
                      type: "image",
                      imageR2Key: "",
                    })
                  }
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-stone-300 rounded-lg text-stone-400 hover:border-teal-400 hover:text-teal-500 transition-colors flex flex-col items-center gap-2"
              >
                <PhotoIcon className="w-8 h-8" />
                <span className="text-sm font-medium">写真をアップロード</span>
                <span className="text-xs">JPG, PNG / 10MB以下</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
};
