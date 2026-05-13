import { PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { LoadingDots } from "@nepp-chan/shared/ui/Loading";

import type { Thread as ThreadType } from "~/types";

type Props = {
  isOpen: boolean;
  threads: ThreadType[];
  currentThreadId: string | null;
  isCreating: boolean;
  onClose: () => void;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onRequestDelete: (id: string) => void;
};

export const ThreadSidebar = ({
  isOpen,
  threads,
  currentThreadId,
  isCreating,
  onClose,
  onNewThread,
  onSelectThread,
  onRequestDelete,
}: Props) => {
  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[40] bg-stone-900/30 backdrop-blur-[3px] cursor-default animate-fade-in"
          onClick={onClose}
          aria-label="サイドバーを閉じる"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 right-0 z-[50] h-full w-[300px] max-w-[85vw]",
          "bg-(--paper-0) border-l border-(--paper-200) flex flex-col",
          "transition-transform duration-300 ease-out will-change-transform",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{ boxShadow: "var(--shadow-float-lg)" }}
      >
        <div className="flex flex-col gap-3 p-4 border-b border-(--paper-200)">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-(--fg-1) font-(family-name:--font-display)">
              スレッド
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-(--paper-100) rounded-md transition-colors"
              aria-label="閉じる"
            >
              <XMarkIcon className="size-5 text-(--fg-3)" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={onNewThread}
            disabled={isCreating}
            className={cn(
              "w-full rounded-lg text-sm font-medium transition-colors",
              "bg-(--brand) text-(--paper-0)",
              "hover:bg-(--brand-hover)",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2",
              "px-4 py-2.5",
            )}
          >
            {isCreating ? (
              <LoadingDots size="sm" />
            ) : (
              <>
                <PlusIcon className="size-4" />
                新しい会話
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {threads.map((thread) => {
            const isSelected = thread.id === currentThreadId;
            return (
              <div
                key={thread.id}
                className={cn(
                  "group relative rounded-lg transition-colors",
                  isSelected ? "bg-(--paper-100)" : "hover:bg-(--paper-100)",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className="w-full min-w-0 text-left flex flex-col gap-1 px-4 py-2.5"
                >
                  <div
                    className={cn(
                      "text-sm font-medium truncate",
                      isSelected ? "text-(--fg-1)" : "text-(--fg-2)",
                    )}
                  >
                    {thread.title ?? "新しい会話"}
                  </div>
                  <div className="text-xs text-(--fg-4)">
                    {new Date(thread.updatedAt).toLocaleDateString("ja-JP")}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDelete(thread.id);
                  }}
                  className={cn(
                    "absolute top-2 right-2 p-1.5 rounded-md transition-all duration-150",
                    "hover:bg-red-100 hover:text-red-600",
                    "text-(--fg-3)",
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                  aria-label="スレッドを削除"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
