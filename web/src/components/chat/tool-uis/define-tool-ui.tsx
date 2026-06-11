import { ToolEmptyState } from "@nepp-chan/shared/ui/EmptyState";
import type { ComponentType, ReactNode } from "react";

import type { ToolPartComponent } from "~/components/chat/types";

/** web の直接依存に zod を増やさないための safeParse 構造型 */
type SchemaLike<TArgs> = {
  safeParse: (
    input: unknown,
  ) => { success: true; data: TArgs } | { success: false };
};

type Config<TArgs> = {
  schema: SchemaLike<TArgs>;
  loading: ReactNode;
  emptyMessage: string;
  isEmpty?: (args: TArgs) => boolean;
  Component: ComponentType<{ args: TArgs }>;
};

/**
 * display 系ツール UI の共通枠を生成する。
 * LLM が生成する args はストリーミング途中・完了後ともに不完全でありうるため、
 * スキーマ検証に通った場合のみ Component へ渡す。
 * - 検証失敗: 実行中ならローディング、完了後は空状態
 * - isEmpty に該当: 空状態
 */
export const defineToolUI = <TArgs,>({
  schema,
  loading,
  emptyMessage,
  isEmpty,
  Component,
}: Config<TArgs>): ToolPartComponent => {
  const ToolUI: ToolPartComponent = ({ args, status }) => {
    const empty = <ToolEmptyState message={emptyMessage} />;
    const parsed = schema.safeParse(args);

    const content = () => {
      if (!parsed.success) {
        return status.type === "running" ? loading : empty;
      }
      if (isEmpty?.(parsed.data)) {
        return empty;
      }
      return <Component args={parsed.data} />;
    };

    return <div className="my-4">{content()}</div>;
  };
  return ToolUI;
};
