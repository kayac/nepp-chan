import { cn } from "~/lib/class-merge";

type LoadingDotsProps = {
  className?: string;
  size?: "sm" | "md";
};

export const LoadingDots = ({ className, size = "md" }: LoadingDotsProps) => (
  <output
    className={cn(
      "loading-dots",
      size === "sm" && "loading-dots-sm",
      className,
    )}
    aria-label="読み込み中"
  >
    <span />
    <span />
    <span />
  </output>
);

type SpinnerProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

export const Spinner = ({ className, size = "md" }: SpinnerProps) => (
  <output
    className={cn(
      "spinner",
      size === "sm" && "spinner-sm",
      size === "lg" && "spinner-lg",
      className,
    )}
    aria-label="読み込み中"
  />
);

type LoadingTextProps = {
  children?: string;
  className?: string;
};

export const LoadingText = ({
  children = "読み込み中",
  className,
}: LoadingTextProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 text-(--color-text-muted) text-sm",
      className,
    )}
  >
    <Spinner size="sm" />
    {children}
  </span>
);

type ToolLoadingVariant = "chart" | "table" | "timeline" | "choice";

type ToolLoadingStateProps = {
  variant: ToolLoadingVariant;
  icon?: React.ReactNode;
};

const variantStyles = {
  chart: {
    container: "rounded-2xl bg-linear-to-r from-teal-50 to-cyan-50 p-5",
    bar: "bg-teal-200",
    skeleton: "bg-teal-100",
  },
  table: {
    container: "rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 p-4",
    bar: "bg-slate-200",
    skeleton: "bg-slate-100",
  },
  timeline: {
    container: "rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 p-4",
    bar: "bg-indigo-200",
    skeleton: "bg-indigo-100",
  },
  choice: {
    container: "rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-4",
    bar: "bg-amber-200",
    skeleton: "bg-amber-100",
  },
} as const;

export const ToolLoadingState = ({ variant, icon }: ToolLoadingStateProps) => {
  const styles = variantStyles[variant];

  if (variant === "chart") {
    return (
      <div className={styles.container}>
        <div className="flex items-center gap-2">
          {icon}
          <div className={cn("h-4 w-32 animate-pulse rounded", styles.bar)} />
        </div>
        <div
          className={cn("mt-4 h-48 animate-pulse rounded-xl", styles.skeleton)}
        />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={styles.container}>
        <div className="flex items-center gap-2">
          {icon}
          <div className={cn("h-4 w-32 animate-pulse rounded", styles.bar)} />
        </div>
        <div className="mt-3 space-y-2">
          <div className={cn("h-8 animate-pulse rounded", styles.bar)} />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn("h-10 animate-pulse rounded", styles.skeleton)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "timeline") {
    return (
      <div className={styles.container}>
        <div className="flex items-center gap-2">
          {icon}
          <div className={cn("h-4 w-32 animate-pulse rounded", styles.bar)} />
        </div>
        <div className="mt-4 space-y-4 pl-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div
                className={cn("size-3 animate-pulse rounded-full", styles.bar)}
              />
              <div className="flex-1 space-y-1">
                <div
                  className={cn("h-4 w-24 animate-pulse rounded", styles.bar)}
                />
                <div
                  className={cn(
                    "h-3 w-48 animate-pulse rounded",
                    styles.skeleton,
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // choice
  return (
    <div className={styles.container}>
      <div className={cn("h-4 w-48 animate-pulse rounded", styles.bar)} />
      <div className="mt-3 flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-10 w-24 animate-pulse rounded-full",
              styles.skeleton,
            )}
          />
        ))}
      </div>
    </div>
  );
};
