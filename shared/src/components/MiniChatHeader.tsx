import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { ReactNode } from "react";

type Props = {
  iconSrc?: string;
  action?: ReactNode;
  className?: string;
};

export const MiniChatHeader = ({
  iconSrc = "/mascot/icon.png",
  action,
  className,
}: Props) => (
  <div
    className={cn(
      "flex items-center gap-3 border-b border-(--paper-200)",
      className,
    )}
  >
    <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-(--teal-50)">
      <img src={iconSrc} alt="" className="size-[34px] object-contain" />
    </span>
    <div className="flex flex-col">
      <span className="font-(family-name:--font-display) text-sm font-bold text-(--snow-800)">
        ねっぷちゃん
      </span>
      <span className="flex items-center gap-1.5 text-[11px] text-(--fg-3)">
        <span className="size-1.5 rounded-full bg-(--success)" />
        オンライン
      </span>
    </div>
    {action}
  </div>
);
