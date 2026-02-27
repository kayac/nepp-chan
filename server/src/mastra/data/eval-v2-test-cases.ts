import type { TestCase } from "./eval-test-cases";

export const evalV2TestCases: TestCase[] = [
  { input: "音威子府村の村長は誰？", groundTruth: "遠藤貴幸" },
  { input: "音威子府村の人口は？", groundTruth: "約588人" },
  { input: "音威子府そばの特徴は？", groundTruth: "黒い色が特徴の蕎麦" },
];
