// 表示用の目安レート。請求は USD で確定し、円表示は直感的な把握のための概算
export const USD_JPY_RATE = 150;

const jpyFormat = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
});

export const formatCostJpy = (usd: number) =>
  `¥${jpyFormat.format(usd * USD_JPY_RATE)}`;
