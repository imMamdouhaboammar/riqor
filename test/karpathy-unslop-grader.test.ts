import { describe, expect, test } from "bun:test";
import { karpathyUnslopGrader } from "../src/scenarios";

describe("karpathyUnslopGrader", () => {
  test("passes clean concise diffs with score 1.0", () => {
    const cleanDiff = `
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,3 +1,3 @@
 function add(a: number, b: number) {
-  return a - b;
+  return a + b;
 }
`;
    const result = karpathyUnslopGrader(cleanDiff);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1.0);
    expect(result.reasons).toEqual([]);
  });

  test("penalizes high comment density slop", () => {
    const commentSlopDiff = `
--- a/src/math.ts
+++ b/src/math.ts
+ // This function computes the sum of two numbers
+ // It takes a parameter a which is the first number
+ // It takes a parameter b which is the second number
+ // Note: this is a very important calculation
+ // We return the result of adding a and b
+ // Make sure a and b are valid numbers
+ // Author: AI Agent
+ // Date: 2026-08-09
+ // Version: 1.0
+ // Change Log: Fixed addition logic
+ // Approved by: Code Reviewer
+ function add(a: number, b: number) {
+   return a + b;
+ }
`;
    const result = karpathyUnslopGrader(commentSlopDiff);
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(0.8);
    expect(result.reasons.some((r) => r.includes("High comment density"))).toBe(true);
  });

  test("penalizes over-abstraction and wrapper slop", () => {
    const abstractionSlopDiff = `
--- a/src/math.ts
+++ b/src/math.ts
+ abstract class AbstractMathFactory {}
+ class AdditionWorkerFactory extends AbstractMathFactory {}
+ class MathOperationWrapperManager {}
+ interface IMathAdapter {}
+ function executeMath() { return new MathOperationWrapperManager(); }
`;
    const result = karpathyUnslopGrader(abstractionSlopDiff);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => r.includes("over-abstraction"))).toBe(true);
  });
});
