import { MCPClient } from "@mastra/mcp";

export const playWrightMcp = new MCPClient({
  id: "playwright-mcp-client",
  servers: {
    playwright: {
      command: "npx",
      args: ["@playwright/mcp@latest", "--headless"],
    },
  },
});
