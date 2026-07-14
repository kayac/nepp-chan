import { cn } from "@nepp-chan/shared/lib/class-merge";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type Variant = "user" | "assistant";

type Props = {
  text: string;
  variant: Variant;
};

const REMARK_PLUGINS = [remarkGfm];

const buildComponents = (variant: Variant): Components => ({
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-1 list-disc pl-5 first:mt-0 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 list-decimal pl-5 first:mt-0 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  h1: ({ children }) => (
    <h1 className="my-1 text-base font-bold first:mt-0 last:mb-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="my-1 text-[0.95em] font-bold first:mt-0 last:mb-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="my-1 text-[0.9em] font-bold first:mt-0 last:mb-0">
      {children}
    </h3>
  ),
  hr: () => (
    <hr
      className={cn(
        "my-2",
        variant === "user" ? "border-white/20" : "border-(--paper-200)",
      )}
    />
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "underline underline-offset-2",
        variant === "user"
          ? "text-white/90 hover:text-white"
          : "text-(--brand) hover:text-(--brand-hover)",
      )}
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code
      className={cn(
        "rounded px-1 py-0.5 font-mono text-[0.85em]",
        variant === "user" ? "bg-white/15" : "bg-(--paper-200) text-(--fg-1)",
      )}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      className={cn(
        "my-1 overflow-x-auto rounded p-2 text-[0.8em] first:mt-0 last:mb-0",
        variant === "user" ? "bg-white/10" : "bg-(--paper-200) text-(--fg-1)",
      )}
    >
      {children}
    </pre>
  ),
});

const COMPONENTS: Record<Variant, Components> = {
  user: buildComponents("user"),
  assistant: buildComponents("assistant"),
};

export const ChatMarkdown = ({ text, variant }: Props) => (
  <ReactMarkdown
    remarkPlugins={REMARK_PLUGINS}
    components={COMPONENTS[variant]}
  >
    {text}
  </ReactMarkdown>
);
