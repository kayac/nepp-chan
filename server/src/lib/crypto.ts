/**
 * 暗号化関連のユーティリティ関数
 */

const toBase64Url = (bytes: ArrayBuffer): string => {
  const u8 = new Uint8Array(bytes);
  let binary = "";
  for (const byte of u8) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const hmacSha256 = async (
  value: string,
  secret: string,
): Promise<string> => {
  if (!secret) {
    throw new Error("hmacSha256: secret は空にできません");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return toBase64Url(signature);
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
