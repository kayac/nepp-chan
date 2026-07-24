import { AmbientBG } from "@nepp-chan/shared";

export const WinterAmbience = () => (
  <div style={{ minHeight: 500 }}>
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(180deg, var(--sky-50) 0%, var(--paper-50) 60%, var(--paper-100) 100%)",
      }}
    />
    <AmbientBG />
    <div
      style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 500,
        gap: 12,
        textAlign: "center",
        padding: 32,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg-1)" }}>
        音威子府村へようこそ
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-2)", maxWidth: 400 }}>
        雪の結晶と星座がゆっくり流れる canvas
        背景演出。チャット画面の最背面に敷かれ、村の冬の空気を伝えます。
      </div>
    </div>
  </div>
);
