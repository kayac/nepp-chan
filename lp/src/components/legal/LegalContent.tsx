import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  title: string;
  content: string;
};

const components: Components = {
  h1: ({ node: _node, className, ...props }) => (
    <h1
      className={cn(
        "mt-8 mb-4 font-(family-name:--font-display) font-bold text-2xl first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ node: _node, className, ...props }) => (
    <h2
      className={cn(
        "mt-8 mb-3 font-(family-name:--font-display) font-bold text-xl first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ node: _node, className, ...props }) => (
    <h3
      className={cn("mt-6 mb-2 font-bold text-base first:mt-0", className)}
      {...props}
    />
  ),
  p: ({ node: _node, className, ...props }) => (
    <p className={cn("leading-[1.9] text-(--fg-1)", className)} {...props} />
  ),
  a: ({ node: _node, className, ...props }) => (
    <a
      className={cn(
        "font-medium text-(--brand) underline underline-offset-2 hover:text-(--brand-hover)",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul
      className={cn("my-2 list-disc pl-6 [&>li]:mt-1", className)}
      {...props}
    />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol
      className={cn("my-2 list-decimal pl-6 [&>li]:mt-1", className)}
      {...props}
    />
  ),
  table: ({ node: _node, className, ...props }) => (
    <div className="my-4 overflow-x-auto">
      <table
        className={cn(
          "w-full border-separate border-spacing-0 border border-(--border-1) text-xs",
          className,
        )}
        {...props}
      />
    </div>
  ),
  th: ({ node: _node, className, ...props }) => (
    <th
      className={cn(
        "border-(--border-1) border-b bg-(--bg-sunken) px-3 py-2 text-left font-semibold text-(--fg-2)",
        className,
      )}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <td
      className={cn(
        "border-(--border-1) border-t px-3 py-2 align-top text-(--fg-1)",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ node: _node, className, ...props }) => (
    <hr className={cn("my-8 border-(--border-1)", className)} {...props} />
  ),
  strong: ({ node: _node, className, ...props }) => (
    <strong className={cn("font-bold text-(--fg-1)", className)} {...props} />
  ),
};

export const LegalContent = ({ title, content }: Props) => (
  <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-(--fg-1)">
    <h1 className="mb-8 font-(family-name:--font-display) font-bold text-2xl">
      {title}
    </h1>
    <article className="flex flex-col gap-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  </main>
);
