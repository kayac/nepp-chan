const READINGS: Record<string, string> = {
  音威子府: "おといねっぷ",
  咲来: "さっくる",
  筬島: "おさしま",
  物満内: "ものまない",
  常盤: "ときわ",
  天北: "てんぽく",
  木遊館: "もくゆうかん",
};

const READING_KEYS = Object.keys(READINGS).sort((a, b) => b.length - a.length);
const READING_RE = new RegExp(READING_KEYS.join("|"), "g");

const PHONE_RE = /(?<!\d)(\d{2,5})-(\d{1,4})-(\d{3,4})(?!\d)/g;
const TIME_RE = /(?<!\d)(\d{1,2})[:：](\d{2})(?!\d)/g;
const RANGE_RE = /[~〜～]\s*(?=\d)/g;
const TIME_RANGE_RE = /([時分])\s*[-－]\s*(?=\d)/g;
const WEEKDAY_RANGE_RE =
  /([月火水木金土日](?:曜日?)?)\s*[~〜～]\s*(?=[月火水木金土日])/g;
const PENDING_NOTATION_RE =
  /(?:[月火水木金土日](?:曜日?)?|[時分])?[\d:：\-－~〜～\s]+$/;

export const toSpeechReading = (text: string) =>
  text
    .replace(PHONE_RE, "$1の$2の$3")
    .replace(
      TIME_RE,
      (_, hour: string, minute: string) =>
        `${Number(hour)}時${minute === "00" ? "" : `${Number(minute)}分`}`,
    )
    .replace(RANGE_RE, "から")
    .replace(TIME_RANGE_RE, "$1から")
    .replace(WEEKDAY_RANGE_RE, "$1から")
    .replace(READING_RE, (word) => READINGS[word]);

const pendingReadingLength = (text: string) => {
  let longest = 0;
  for (const key of READING_KEYS) {
    for (
      let len = Math.min(key.length - 1, text.length);
      len > longest;
      len--
    ) {
      if (text.endsWith(key.slice(0, len))) {
        longest = len;
        break;
      }
    }
  }
  return longest;
};

export const createSpeechReader = () => {
  let buffer = "";
  return {
    push(delta: string) {
      buffer += delta;
      const pending = Math.max(
        buffer.match(PENDING_NOTATION_RE)?.[0].length ?? 0,
        pendingReadingLength(buffer),
      );
      const ready = buffer.slice(0, buffer.length - pending);
      buffer = buffer.slice(ready.length);
      return toSpeechReading(ready);
    },
    flush() {
      const rest = buffer;
      buffer = "";
      return toSpeechReading(rest);
    },
  };
};
