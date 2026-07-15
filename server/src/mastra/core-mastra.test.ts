import { describe, expect, it } from "vitest";
import { getCoreMastra } from "./core-mastra";

describe("getCoreMastra", () => {
  it("同一インスタンスを返し、全 Agent が登録されている", () => {
    const mastra = getCoreMastra();
    expect(getCoreMastra()).toBe(mastra);

    const agents = [
      mastra.getAgent("intentRouterAgent"),
      mastra.getAgent("converterAgent"),
      mastra.getAgent("knowledgeRerankerAgent"),
    ];
    for (const agent of agents) {
      expect(agent.getMastraInstance()).toBe(mastra);
    }
  });
});
