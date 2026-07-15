import { ApiError, client } from "~/lib/api/client";

export const fetchCallToken = async () => {
  try {
    const { data, error } = await client.POST("/twilio/voice/token");
    if (error || !data) {
      throw new Error("通話トークンの取得に失敗しました");
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      throw new Error(
        "管理者ログインが必要です。ダッシュボードでログインしてから使ってください。",
      );
    }
    throw e;
  }
};

export const fetchVoicePresets = async () => {
  const { data, error } = await client.GET("/twilio/voice/presets");
  if (error || !data) {
    throw new Error("ボイスプリセットの取得に失敗しました");
  }
  return data;
};
