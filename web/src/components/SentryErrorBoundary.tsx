import * as Sentry from "@sentry/react";

export const SentryErrorBoundary = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <Sentry.ErrorBoundary
    fallback={() => (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-900">
            エラーが発生しました
          </h1>
          <p className="text-stone-600 mt-2">ページを再読み込みしてください</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg"
          >
            再読み込み
          </button>
        </div>
      </div>
    )}
  >
    {children}
  </Sentry.ErrorBoundary>
);
