/**
 * 暗号化関連のユーティリティ関数
 */

export const toBase64Url = (bytes: ArrayBuffer | Uint8Array) => {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of u8) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const base64UrlFromString = (value: string) =>
  toBase64Url(new TextEncoder().encode(value));

export const base64UrlToString = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const signHmac = async (
  hash: "SHA-256" | "SHA-1",
  value: string,
  secret: string,
) => {
  if (!secret) {
    throw new Error("HMAC の secret は空にできません");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
};

export const hmacSha256 = async (value: string, secret: string) =>
  toBase64Url(await signHmac("SHA-256", value, secret));

export const hmacSha256Hex = async (value: string, secret: string) =>
  Array.from(new Uint8Array(await signHmac("SHA-256", value, secret)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

export const timingSafeEqual = (a: string, b: string) => {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
};

// Twilio X-Twilio-Signature 互換（HMAC-SHA1 + 標準 base64、パディングあり）
export const hmacSha1Base64 = async (value: string, secret: string) => {
  const signature = await signHmac("SHA-1", value, secret);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

export const generateId = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

export const generateToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};
