import type { UIMessage } from "ai";

type Props = {
  message: UIMessage;
};

const getMessageContent = (message: UIMessage): string => {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
};

export const MessageItem = ({ message }: Props) => {
  const isUser = message.role === "user";
  const content = getMessageContent(message);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser
            ? "bg-blue-500 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        }`}
      >
        {!isUser && (
          <div className="text-xs text-gray-500 mb-1 font-medium">
            ねっぷちゃん
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </div>
    </div>
  );
};
