import { client } from "~/lib/api/client";

export const fetchCallToken = async () => {
  const { data, error } = await client.POST("/twilio/voice/token");
  if (error || !data) {
    throw new Error("通話トークンの取得に失敗しました");
  }
  return data;
};

export const fetchVoicePresets = async () => {
  const { data, error } = await client.GET("/twilio/voice/presets");
  if (error || !data) {
    throw new Error("ボイスプリセットの取得に失敗しました");
  }
  return data;
};
