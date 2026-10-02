// commentary.append の content は 1 回 500 トークンまで。日本語はおおむね
// 1 文字 1 トークンなので、文字数で余裕を持って区切る。
const MAX_CHARS = 350;

const SENTENCE_END = /[。！？?!]/;

// 文末で切り出せるところまでを返し、残りを持ち越す。上限に達したら文末を待たずに切る。
export const takeChunk = (buffer: string, flush: boolean) => {
  if (flush) return { chunk: buffer.trim(), rest: "" };

  let cut = -1;
  for (let i = 0; i < Math.min(buffer.length, MAX_CHARS); i++) {
    if (SENTENCE_END.test(buffer[i])) cut = i + 1;
  }
  if (cut === -1) {
    if (buffer.length < MAX_CHARS) return { chunk: "", rest: buffer };
    cut = MAX_CHARS;
  }
  return { chunk: buffer.slice(0, cut).trim(), rest: buffer.slice(cut) };
};

// 上限を超える 1 文はそのままでは送れないので、上限ごとに割る。
export const splitForAppend = (content: string) => {
  const parts: string[] = [];
  let rest = content.trim();
  while (rest.length > MAX_CHARS) {
    parts.push(rest.slice(0, MAX_CHARS));
    rest = rest.slice(MAX_CHARS);
  }
  if (rest) parts.push(rest);
  return parts;
};
