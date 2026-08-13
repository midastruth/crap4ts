import { readFile } from "node:fs/promises";

import { calculateCrap } from "./crap-score.ts";
import { coverageForMethod, parseIstanbulCoverage } from "./istanbul-coverage.ts";
import { parseTypeScriptMethods } from "./typescript-method-parser.ts";
import type { MethodMetrics } from "./types.ts";

export async function analyzeFiles(files: string[], coverageFile: string): Promise<MethodMetrics[]> {
  const coverage = await parseIstanbulCoverage(coverageFile);
  const metrics: MethodMetrics[] = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    for (const method of parseTypeScriptMethods(filePath, source)) {
      const methodCoverage = coverageForMethod(coverage, method);
      metrics.push({
        name: method.name,
        className: method.className,
        filePath,
        complexity: method.complexity,
        coverage: methodCoverage,
        crapScore: calculateCrap(method.complexity, methodCoverage),
      });
    }
  }
  return metrics;
}
