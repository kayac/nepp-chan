import { LoadingText } from "@nepp-chan/shared/ui/Loading";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const SectionCard = ({ title, description, children }: Props) => (
  <section className="bg-(--bg-raised) rounded-xl border border-(--border-1) p-5">
    <div className="mb-4">
      <h3 className="text-base font-semibold text-(--fg-1)">{title}</h3>
      {description && (
        <p className="text-xs text-(--fg-3) mt-0.5">{description}</p>
      )}
    </div>
    {children}
  </section>
);

export const SectionLoading = () => (
  <div className="py-8 flex justify-center">
    <LoadingText>読み込み中...</LoadingText>
  </div>
);

export const SectionEmpty = ({ children }: { children: React.ReactNode }) => (
  <div className="py-8 text-center text-(--fg-3) text-sm">{children}</div>
);

export const SectionError = ({ error }: { error: unknown }) => (
  <ErrorBanner>{formatError(error)}</ErrorBanner>
);
