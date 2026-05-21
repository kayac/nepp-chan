import type { messagingApi } from "@line/bot-sdk";

// shared/src/styles/index.css の `--panel` と同値（LINE は CSS 変数非対応のため値を保持）
export const PANEL_BACKGROUND = "#dfe2e3";

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
