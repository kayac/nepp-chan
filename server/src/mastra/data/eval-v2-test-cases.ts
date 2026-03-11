import type { TestCase } from "./eval-test-cases";
import { evalTestCases } from "./eval-test-cases";

/** V2 用テストケース: マスターから input/groundTruth を抽出 */
export const evalV2TestCases: TestCase[] = evalTestCases.map(
  ({ input, groundTruth }) => ({ input, groundTruth }),
);
