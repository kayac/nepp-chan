import { Bars3Icon } from "@heroicons/react/24/outline";
import { cn } from "~/lib/class-merge";

type Props = {
  onMenuClick: () => void;
  showOnlineStatus?: boolean;
  className?: string;
};

export const TopBar = ({
  onMenuClick,
  showOnlineStatus = true,
  className,
}: Props) => (
  <div
    className={cn(
      "relative z-[3] flex items-center justify-between px-7 py-5",
      className,
    )}
  >
    <div className="flex items-center gap-2.5">
      <span
        className="size-2 rounded-full bg-(--teal-500)"
        style={{ boxShadow: "0 0 0 3px rgba(20, 184, 166, 0.18)" }}
        aria-hidden="true"
      />
      <span className="font-(family-name:--font-display) font-bold text-(--snow-800) tracking-wider text-[15px]">
        ねっぷちゃん
      </span>
    </div>

    <div className="flex items-center gap-3">
      {showOnlineStatus && (
        <div className="flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase text-(--fg-3)">
          <span
            className="size-1.5 rounded-full bg-(--moss-500)"
            aria-hidden="true"
          />
          <span>ONLINE</span>
        </div>
      )}
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
  </div>
);
