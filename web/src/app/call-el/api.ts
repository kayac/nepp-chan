import { ApiError, client } from "~/lib/api/client";

export const fetchSignedUrl = async () => {
  try {
    const { data, error } = await client.POST("/elevenlabs/voice/signed-url");
    if (error || !data) {
      throw new Error("会話用 URL の取得に失敗しました");
    }
    return data.signedUrl;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      throw new Error(
        "管理者ログインが必要です。ダッシュボードでログインしてから使ってください。",
      );
    }
    throw e;
  }
};
