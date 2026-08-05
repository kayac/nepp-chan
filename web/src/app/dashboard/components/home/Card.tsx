interface Props {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const Card = ({ title, action, children }: Props) => (
  <section className="min-w-0 bg-(--bg-raised) rounded-xl border border-(--border-1) p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-(--fg-1)">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);
