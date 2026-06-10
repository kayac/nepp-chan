interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const SectionCard = ({
  title,
  description,
  children,
}: SectionCardProps) => (
  <section className="bg-white rounded-xl border border-stone-200 p-5">
    <div className="mb-4">
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      {description && (
        <p className="text-xs text-stone-500 mt-0.5">{description}</p>
      )}
    </div>
    {children}
  </section>
);

export const SectionLoading = () => (
  <div className="py-8 text-center text-stone-500 text-sm">読み込み中...</div>
);

export const SectionEmpty = ({ children }: { children: React.ReactNode }) => (
  <div className="py-8 text-center text-stone-500 text-sm">{children}</div>
);

export const SectionError = ({ error }: { error: unknown }) => (
  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
    エラー: {error instanceof Error ? error.message : "Unknown error"}
  </div>
);
