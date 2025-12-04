import { LibSQLStore } from "@mastra/libsql";
import { createMastra } from "./factory";

export const mastra = createMastra(
  new LibSQLStore({
    id: "mastra-storage",
    url: ":memory:",
  }),
);
