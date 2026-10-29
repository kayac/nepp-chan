import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render, renderHook } from "@testing-library/react";
import {
  createElement,
  type PropsWithChildren,
  type ReactElement,
} from "react";

const buildClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

export const renderHookWithQuery = <Result, Props>(
  hook: (props: Props) => Result,
  options: Omit<RenderOptions, "wrapper"> & { initialProps?: Props } = {},
) => {
  const client = buildClient();
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(hook, { wrapper, ...options });
};

export const renderWithQuery = (
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> = {},
) => {
  const client = buildClient();
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  return render(ui, { wrapper, ...options });
};
