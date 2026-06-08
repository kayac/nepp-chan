import type { ComponentType } from "react";

export type ToolPartStatus =
  | { readonly type: "running" }
  | { readonly type: "complete" }
  | {
      readonly type: "incomplete";
      readonly reason: "error";
      readonly error?: unknown;
    };

export type ToolPartProps<TArgs = unknown, TResult = unknown> = {
  readonly toolName: string;
  readonly args: TArgs;
  readonly argsText: string;
  readonly result?: TResult | undefined;
  readonly status: ToolPartStatus;
};

export type ToolPartComponent<
  TArgs = unknown,
  TResult = unknown,
> = ComponentType<ToolPartProps<TArgs, TResult>>;
