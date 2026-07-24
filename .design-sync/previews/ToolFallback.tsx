import { ToolFallback } from "@nepp-chan/shared";

const frame: React.CSSProperties = {
  maxWidth: 480,
  padding: 16,
};

export const Running = () => (
  <div style={frame}>
    <ToolFallback
      toolName="searchKnowledge"
      args={{ query: "音威子府 そば屋 営業時間" }}
      status={{ type: "running" }}
    />
  </div>
);

export const Complete = () => (
  <div style={frame}>
    <ToolFallback
      toolName="searchKnowledge"
      args={{ query: "天塩川温泉 アクセス" }}
      result={{
        results: [
          {
            title: "天塩川温泉のご案内",
            snippet:
              "音威子府村の中心部から車で約8分。日帰り入浴は10:00〜21:00、露天風呂から天塩川を望めます。",
          },
        ],
      }}
      status={{ type: "complete" }}
    />
  </div>
);

export const ErrorState = () => (
  <div style={frame}>
    <ToolFallback
      toolName="emergencyReportTool"
      args={{ category: "road", detail: "国道40号の路肩が崩れている" }}
      status={{
        type: "incomplete",
        reason: "error",
        error: "報告の送信に失敗しました。時間をおいてもう一度お試しください。",
      }}
    />
  </div>
);
