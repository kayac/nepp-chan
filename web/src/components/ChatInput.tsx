import { type FormEvent, type KeyboardEvent, useState } from "react";

type Props = {
  onSend: (message: string) => void;
  disabled: boolean;
};

export const ChatInput = ({ onSend, disabled }: Props) => {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-[var(--color-border)] bg-white p-4 shrink-0"
    >
      <div className="max-w-2xl mx-auto flex gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none disabled:bg-[var(--color-surface)] disabled:text-[var(--color-text-muted)] transition-colors"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-5 py-2.5 bg-[var(--color-accent)] text-white text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          送信
        </button>
      </div>
    </form>
  );
};
