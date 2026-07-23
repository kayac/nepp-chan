import { CheckIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { Button } from "@nepp-chan/shared/ui/Button";
import {
  createContext,
  isValidElement,
  memo,
  type ReactNode,
  useContext,
} from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";

/** code が pre（コードブロック）配下かどうか。inline コードと区別するために使う。 */
const IsCodeBlockContext = createContext(false);

const reactNodeToText = (node: ReactNode): string => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return reactNodeToText(node.props.children);
  }
  return "";
};

const extractCode = (children: ReactNode) => {
  const child = Array.isArray(children) ? children[0] : children;
  if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) {
    return { language: "", code: "" };
  }
  const language =
    /language-(\w+)/.exec(child.props.className ?? "")?.[1] ?? "";
  return { language, code: reactNodeToText(child.props.children) };
};

const CodeHeader = ({ language, code }: { language: string; code: string }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="aui-code-header-root mt-4 flex items-center justify-between gap-4 rounded-t-lg bg-(--bg-sunken) px-4 py-2 font-semibold text-(--fg-2) text-sm">
      <span className="aui-code-header-language lowercase [&>span]:text-xs">
        {language}
      </span>
      <Button variant="ghost" size="icon-xs" aria-label="Copy" onClick={onCopy}>
        {!isCopied && <DocumentDuplicateIcon />}
        {isCopied && <CheckIcon />}
      </Button>
    </div>
  );
};

const components: Components = {
  h1: ({ node: _node, className, ...props }) => (
    <h1
      className={cn(
        "aui-md-h1 mb-8 scroll-m-20 font-(family-name:--font-display) font-extrabold text-4xl tracking-tight last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ node: _node, className, ...props }) => (
    <h2
      className={cn(
        "aui-md-h2 mt-8 mb-4 scroll-m-20 font-(family-name:--font-display) font-bold text-3xl tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ node: _node, className, ...props }) => (
    <h3
      className={cn(
        "aui-md-h3 mt-6 mb-4 scroll-m-20 font-(family-name:--font-display) font-bold text-2xl tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ node: _node, className, ...props }) => (
    <h4
      className={cn(
        "aui-md-h4 mt-6 mb-4 scroll-m-20 font-(family-name:--font-display) font-bold text-xl tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ node: _node, className, ...props }) => (
    <h5
      className={cn(
        "aui-md-h5 my-4 font-semibold text-lg first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ node: _node, className, ...props }) => (
    <h6
      className={cn(
        "aui-md-h6 my-4 font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  p: ({ node: _node, className, ...props }) => (
    <p
      className={cn(
        "aui-md-p mt-5 mb-5 leading-7 first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  a: ({ node: _node, className, ...props }) => (
    <a
      className={cn(
        "aui-md-a font-medium text-(--brand) underline underline-offset-4",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ node: _node, className, ...props }) => (
    <blockquote
      className={cn(
        "aui-md-blockquote border-l-2 border-(--border-1) pl-6 italic",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul
      className={cn("aui-md-ul my-5 ml-6 list-disc [&>li]:mt-2", className)}
      {...props}
    />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol
      className={cn("aui-md-ol my-5 ml-6 list-decimal [&>li]:mt-2", className)}
      {...props}
    />
  ),
  hr: ({ node: _node, className, ...props }) => (
    <hr
      className={cn("aui-md-hr my-5 border-b border-(--border-1)", className)}
      {...props}
    />
  ),
  table: ({ node: _node, className, ...props }) => (
    <table
      className={cn(
        "aui-md-table my-5 w-full border-separate border-spacing-0 overflow-y-auto",
        className,
      )}
      {...props}
    />
  ),
  th: ({ node: _node, className, ...props }) => (
    <th
      className={cn(
        "aui-md-th bg-(--bg-sunken) px-4 py-2 text-left font-semibold text-(--fg-2) first:rounded-tl-lg last:rounded-tr-lg [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <td
      className={cn(
        "aui-md-td border-b border-l border-(--border-1) px-4 py-2 text-left text-(--fg-2) last:border-r [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  tr: ({ node: _node, className, ...props }) => (
    <tr
      className={cn(
        "aui-md-tr m-0 border-b border-(--border-1) p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
        className,
      )}
      {...props}
    />
  ),
  sup: ({ node: _node, className, ...props }) => (
    <sup
      className={cn("aui-md-sup [&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  pre: ({ node: _node, className, children, ...props }) => {
    const { language, code } = extractCode(children);
    return (
      <IsCodeBlockContext.Provider value={true}>
        <CodeHeader language={language} code={code} />
        <pre
          className={cn(
            "aui-md-pre overflow-x-auto rounded-t-none! rounded-b-lg bg-black p-4 text-white",
            className,
          )}
          {...props}
        >
          {children}
        </pre>
      </IsCodeBlockContext.Provider>
    );
  },
  code: ({ node: _node, className, ...props }) => {
    const isCodeBlock = useContext(IsCodeBlockContext);
    return (
      <code
        className={cn(
          !isCodeBlock &&
            "aui-md-inline-code rounded border border-(--border-1) bg-(--bg-sunken) font-semibold",
          className,
        )}
        {...props}
      />
    );
  },
};

const MarkdownTextImpl = ({ text }: { text: string }) => (
  <div className="aui-md">
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </Markdown>
  </div>
);

export const MarkdownText = memo(MarkdownTextImpl);
