const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const ALGORITHM = "PBKDF2";
const HASH = "SHA-256";

const encode = (data: Uint8Array): string => btoa(String.fromCharCode(...data));

const decode = (str: string): Uint8Array =>
  Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

export const hashPassword = async (password: string): Promise<string> => {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    ALGORITHM,
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: ALGORITHM, hash: HASH, salt, iterations: ITERATIONS },
    key,
    KEY_LENGTH * 8,
  );

  const hash = new Uint8Array(derivedBits);
  return `${ITERATIONS}:${encode(salt)}:${encode(hash)}`;
};

export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [iterStr, saltB64, hashB64] = stored.split(":");
  const iterations = Number(iterStr);
  const salt = decode(saltB64);
  const storedHash = decode(hashB64);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    ALGORITHM,
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: ALGORITHM, hash: HASH, salt, iterations },
    key,
    storedHash.length * 8,
  );

  const computed = new Uint8Array(derivedBits);

  if (computed.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed[i] ^ storedHash[i];
  }
  return result === 0;
};
