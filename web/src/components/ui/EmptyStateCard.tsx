import type { ReactNode } from "react";

export const EmptyStateCard = ({ children }: { children: ReactNode }) => (
  <div className="bg-(--bg-raised) rounded-xl border border-(--border-1) p-6 text-center text-(--fg-3)">
    {children}
  </div>
);
