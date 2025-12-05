import { LibSQLStore } from "@mastra/libsql";
import { createMastra } from "~/mastra/factory";

export const mastra = createMastra(
  new LibSQLStore({
    id: "mastra-storage",
    url: ":memory:",
  }),
);
