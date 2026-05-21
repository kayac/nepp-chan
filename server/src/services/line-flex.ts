import type { messagingApi } from "@line/bot-sdk";

// LINE に出すパネル（Flex Bubble）の共通ヘッダー・地色。
// hero 画像の裾とパネルを地続きに見せるため body と hero を同じグレーにする。
// shared/src/styles/index.css の `--panel` と同値（LINE は CSS 変数非対応のため値を保持）。
export const PANEL_BACKGROUND = "#dfe2e3";

// hero 画像（山）は web の静的アセットとして配信（LINE 実機は HTTPS 公開 URL が必須）
const HERO_IMAGE_PATH =
  "/line-assets/hero-mountain-generated-20x2-full-nearest.png";

export const buildHeroImage = (webUrl: string): messagingApi.FlexImage => ({
  type: "image",
  url: `${webUrl}${HERO_IMAGE_PATH}`,
  size: "full",
  aspectRatio: "20:2",
  aspectMode: "cover",
  backgroundColor: PANEL_BACKGROUND,
});

// 共通ヘッダー（hero）＋ 溶け込みパネル本文 を持つ Bubble を組み立てる。
// 本文の中身（テキスト・ボタン等）は呼び出し側が contents で渡す。
export const buildPanelBubble = (
  webUrl: string,
  bodyContents: messagingApi.FlexComponent[],
): messagingApi.FlexBubble => ({
  type: "bubble",
  size: "mega",
  hero: buildHeroImage(webUrl),
  body: {
    type: "box",
    layout: "vertical",
    paddingAll: "20px",
    backgroundColor: PANEL_BACKGROUND,
    contents: bodyContents,
  },
});
