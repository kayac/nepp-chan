import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  className?: string;
  titleClassName?: string;
};

export const ModalHeader = ({
  title,
  description,
  onClose,
  className,
  titleClassName,
}: Props) => (
  <div
    className={cn(
      "flex justify-between",
      description ? "items-start" : "items-center",
      className,
    )}
  >
    <div>
      <h2 className={cn("font-bold text-(--fg-1)", titleClassName)}>{title}</h2>
      {description && (
        <p className="text-sm text-(--fg-3) mt-1">{description}</p>
      )}
    </div>
    <button
      type="button"
      onClick={onClose}
      className="p-1 text-(--fg-3) hover:text-(--fg-1) hover:bg-(--bg-sunken) rounded-md transition-colors"
      aria-label="閉じる"
    >
      <XMarkIcon className="w-5 h-5" aria-hidden="true" />
    </button>
  </div>
);
