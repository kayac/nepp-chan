const SAMPLE_RATE = 8000;
const FRAME_SAMPLES = 160;
const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

const EXPONENT_BY_HIGH_BYTE = [
  0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
];

// G.711 μ-law。無音（振幅 0）は 0xFF になる。
const encodeMuLaw = (sample: number) => {
  const sign = sample < 0 ? 0x80 : 0;
  const magnitude = Math.min(Math.abs(sample), MULAW_CLIP) + MULAW_BIAS;
  const exponent = EXPONENT_BY_HIGH_BYTE[(magnitude >> 7) & 0xff];
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
};

type ChimeOptions = {
  hz?: number;
  ms?: number;
  decay?: number;
  amplitude?: number;
};

// 通話がつながったことを知らせる「ポーン」。減衰する正弦波を μ-law 8kHz の
// フレーム列にして返す。
export const buildChimeFrames = ({
  hz = 880,
  ms = 400,
  decay = 8,
  amplitude = 0.35,
}: ChimeOptions = {}) => {
  const frameCount = Math.round((ms / 1000) * SAMPLE_RATE) / FRAME_SAMPLES;
  const frames: string[] = [];

  for (let frame = 0; frame < frameCount; frame++) {
    const bytes = new Uint8Array(FRAME_SAMPLES);
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const t = (frame * FRAME_SAMPLES + i) / SAMPLE_RATE;
      const envelope = Math.exp(-decay * t);
      const value = Math.sin(2 * Math.PI * hz * t) * envelope * amplitude;
      bytes[i] = encodeMuLaw(Math.round(value * 32767));
    }
    frames.push(btoa(String.fromCharCode(...bytes)));
  }

  return frames;
};
