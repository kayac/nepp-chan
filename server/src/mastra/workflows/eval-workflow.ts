import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import {
  evalResultSchema,
  extractKnowledgeSearchResults,
  runEvalScorers,
} from "./utils/eval-helpers";

const testCaseSchema = z.object({
  input: z.string(),
  groundTruth: z.string(),
});

const runSingleEval = createStep({
  id: "run-single-eval",
  description: "Run evaluation for a single test case",
  inputSchema: testCaseSchema,
  outputSchema: evalResultSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error("Input data not found");
    }

    const agent = mastra?.getAgent("nepChanAgent");
    if (!agent) {
      throw new Error("nepChanAgent not found");
    }

    const result = await agent.generate(inputData.input);
    const retrievedChunks = extractKnowledgeSearchResults(result.steps);
    const scores = await runEvalScorers({
      input: inputData.input,
      output: result.text,
      groundTruth: inputData.groundTruth,
      context: retrievedChunks.map((c) => c.content),
    });

    return {
      input: inputData.input,
      groundTruth: inputData.groundTruth,
      answer: result.text,
      retrievedChunks,
      scores,
    };
  },
});

const evalWorkflow = createWorkflow({
  id: "eval-workflow",
  inputSchema: testCaseSchema,
  outputSchema: evalResultSchema,
}).then(runSingleEval);

evalWorkflow.commit();

export { evalWorkflow };
