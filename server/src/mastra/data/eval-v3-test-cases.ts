export type {
  TestCaseV3,
  TestCategory,
  TestType,
} from "./eval-test-cases";

import { evalTestCases } from "./eval-test-cases";

/** V3 用テストケース: マスターからそのまま使用 */
export const evalV3TestCases = evalTestCases;
