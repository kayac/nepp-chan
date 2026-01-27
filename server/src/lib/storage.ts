import { D1Store } from "@mastra/cloudflare-d1";

let cachedStorage: D1Store | null = null;
let cachedDb: D1Database | null = null;

export const getStorage = async (db: D1Database) => {
  if (cachedStorage && cachedDb === db) {
    return cachedStorage;
  }

  const storage = new D1Store({ id: "mastra-storage", binding: db });
  await storage.init();
  cachedStorage = storage;
  cachedDb = db;
  return storage;
};
