/**
 * server と web の両方が参照するエージェント登録 toolName（tools オブジェクトのキー）。
 * server の登録キー・instructions 内の参照・web のフォールバック表示分類を
 * この定数で一致させる契約。display 系ツールは display-tools.ts を参照。
 * server 内に閉じる toolName は各ツール定義ファイルの定数を使う。
 */
export const AGENT_TOOL_NAMES = {
  emergencyReport: "emergencyReportTool",
  emergencyUpdate: "emergencyUpdateTool",
} as const;
