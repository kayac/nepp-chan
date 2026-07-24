import { UserMessage } from "@nepp-chan/shared";

const thread: React.CSSProperties = {
  width: "100%",
  maxWidth: 640,
  padding: "0 16px",
  ["--thread-max-width" as string]: "42rem",
};

export const Question = () => (
  <div style={thread}>
    <UserMessage
      message={{
        id: "u1",
        role: "user",
        parts: [
          { type: "text", text: "音威子府そばが食べられるお店を教えて！" },
        ],
      }}
    />
  </div>
);

export const MultiLine = () => (
  <div style={thread}>
    <UserMessage
      message={{
        id: "u2",
        role: "user",
        parts: [
          {
            type: "text",
            text: "来月、家族で村に遊びに行く予定です。\n・冬でも楽しめる場所\n・子どもと一緒に行けるところ\nを知りたいです！",
          },
        ],
      }}
    />
  </div>
);

export const Short = () => (
  <div style={thread}>
    <UserMessage
      message={{
        id: "u3",
        role: "user",
        parts: [{ type: "text", text: "ありがとう！行ってみるね🌲" }],
      }}
    />
  </div>
);
