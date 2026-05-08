import createOpenApiClient, { type Client } from "openapi-fetch";
import { ApiError, parseErrorResponse } from "./errors";
import type { paths } from "./types.d";

export type ApiClient = Client<paths>;

export type CreateApiClientOptions = {
  /** ベース URL（例: `https://api.example.com`） */
  baseUrl: string;
  /** 各リクエストで Authorization に載せる Bearer トークンを返す。null/undefined なら無付与 */
  getAuthToken?: () => string | null;
  /**
   * 401 を受けたとき呼ばれる。トークン破棄やキャッシュ無効化など app 側の後処理に使う。
   * `sentAuth` は失敗したリクエストが実際に送った Authorization ヘッダ値。
   * 並行呼び出しで getAuthToken() が破棄済み状態を返すケースでも、
   * リクエスト単位の判定ができるようリクエスト由来の値を渡す。
   * 戻り値で「fallback トークンで再試行するか」を制御する:
   * - 何も返さない / false: 再試行しない（fallback 不在）
   * - true: getAuthToken() を再評価し、前回送信と異なるトークンが取れれば再試行
   */
  onUnauthorized?: (sentAuth: string) => boolean | void;
  /** 5xx 系のときだけ呼ばれる observer。Sentry 等の通報先に流す用途 */
  onServerError?: (error: ApiError, response: Response) => void;
};

/**
 * openapi-fetch が module 読み込み時に globalThis.fetch をキャプチャしてしまうのを避け、
 * 常に lazy lookup する custom fetch を返す。auth retry も同じハンドラに統合する。
 */
const buildFetch = (options: CreateApiClientOptions) => {
  const onUnauthorized = options.onUnauthorized;

  return async (request: Request): Promise<Response> => {
    const retryRequest = request.clone();
    const response = await globalThis.fetch(request);
    if (response.status !== 401 || !onUnauthorized) return response;

    const sentAuth = retryRequest.headers.get("Authorization");
    if (!sentAuth) return response;

    const shouldRetry = onUnauthorized(sentAuth);
    if (!shouldRetry) return response;

    const headers = new Headers(retryRequest.headers);
    const fallbackToken = options.getAuthToken?.();
    if (fallbackToken && `Bearer ${fallbackToken}` !== sentAuth) {
      headers.set("Authorization", `Bearer ${fallbackToken}`);
    } else if (!fallbackToken) {
      headers.delete("Authorization");
    } else {
      // fallback が前回と同じなら再試行しても同じ結果。スキップ
      return response;
    }
    return globalThis.fetch(new Request(retryRequest, { headers }));
  };
};

/**
 * openapi-fetch ベースの API クライアントを生成する factory。
 * 認証トークンの付与・401 fallback retry・5xx の通報フックを options で合成する。
 */
export const createApiClient = (options: CreateApiClientOptions): ApiClient => {
  const client = createOpenApiClient<paths>({
    baseUrl: options.baseUrl,
    fetch: buildFetch(options),
  });

  client.use({
    async onRequest({ request }) {
      const token = options.getAuthToken?.();
      if (token) {
        request.headers.set("Authorization", `Bearer ${token}`);
      }
      return request;
    },
  });

  client.use({
    async onResponse({ response }) {
      if (!response.ok) {
        const message = await parseErrorResponse(response);
        const error = new ApiError(message, response.status);
        if (response.status >= 500) {
          options.onServerError?.(error, response);
        }
        throw error;
      }
      return response;
    },
  });

  return client;
};
