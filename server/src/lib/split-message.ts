const LINE_MAX_MESSAGES = 5;
const LINE_MAX_CHARS = 5000;

export const splitMessagesForLine = (texts: string[]): string[] => {
  const messages: string[] = [];

  for (const text of texts) {
    if (!text || text.trim().length === 0) continue;

    if (text.length <= LINE_MAX_CHARS) {
      messages.push(text);
    } else {
      for (let i = 0; i < text.length; i += LINE_MAX_CHARS) {
        messages.push(text.slice(i, i + LINE_MAX_CHARS));
        if (messages.length >= LINE_MAX_MESSAGES) break;
      }
    }

    if (messages.length >= LINE_MAX_MESSAGES) break;
  }

  return messages.slice(0, LINE_MAX_MESSAGES);
};
