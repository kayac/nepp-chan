import { cn } from "@nepp-chan/shared/lib/class-merge";
import { type ReactNode, useEffect, useRef } from "react";

type Props = {
  onClose: () => void;
  className?: string;
  children: ReactNode;
};

// マウント時の showModal() は StrictMode の二重 effect で open 済みなら何もしない
export const Dialog = ({ onClose, className, children }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  return (
    // backdrop クリックで閉じる。ESC（キーボード）は native の onClose が拾う
    // biome-ignore lint/a11y/useKeyWithClickEvents: ESC は dialog の onClose で対応済み
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className={cn(
        "m-auto bg-transparent p-0 backdrop:bg-black/50",
        className,
      )}
    >
      {children}
    </dialog>
  );
};
