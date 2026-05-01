import { Bars3Icon } from "@heroicons/react/24/outline";
import { cn } from "~/lib/class-merge";
import { LP_URL } from "~/lib/lp-url";

type Props = {
  onMenuClick: () => void;
  className?: string;
};

export const TopBar = ({ onMenuClick, className }: Props) => (
  <div
    className={cn(
      "relative z-[3] flex items-center justify-between px-4 py-3 sm:px-7 sm:py-3.5",
      className,
    )}
  >
    <a
      href={LP_URL}
      className="flex items-center gap-2 font-(family-name:--font-display) text-lg font-bold text-(--snow-800) sm:gap-2.5 transition-opacity hover:opacity-80"
      aria-label="ねっぷちゃん 紹介ページへ"
    >
      <img
        className="block h-9 w-auto sm:h-[52px]"
        src="/logo-neppu.png"
        alt="ねっぷちゃん"
      />
      <span className="rounded-(--r-pill) bg-(--teal-50) px-2 py-0.5 text-[10px] font-medium tracking-[0.04em] text-(--brand) sm:text-[11px]">
        BETA
      </span>
    </a>

    <button
      type="button"
      onClick={onMenuClick}
      className={cn(
        "size-9 rounded-full grid place-items-center text-(--fg-2)",
        "border border-(--paper-200) bg-(--paper-0)",
        "transition-colors hover:border-(--teal-300) hover:text-(--teal-700)",
      )}
      aria-label="メニュー"
    >
      <Bars3Icon className="size-5" aria-hidden="true" />
    </button>
  </div>
);
