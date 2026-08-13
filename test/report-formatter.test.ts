import assert from "node:assert/strict";
import test from "node:test";

import { formatReport, sortMetrics } from "../src/report-formatter.ts";
import type { MethodMetrics } from "../src/types.ts";

test("sorts worst CRAP first with unavailable coverage last", () => {
  const metrics: MethodMetrics[] = [
    { name: "safe", className: null, filePath: "src/a.ts", complexity: 1, coverage: 1, crapScore: 1 },
    { name: "unknown", className: null, filePath: "src/c.ts", complexity: 2, coverage: null, crapScore: null },
    { name: "risky", className: "Job", filePath: "src/b.ts", complexity: 3, coverage: 0, crapScore: 12 },
  ];

  assert.deepEqual(sortMetrics(metrics).map((metric) => metric.name), ["risky", "safe", "unknown"]);
  const report = formatReport(metrics, "/project");
  assert.match(report, /Job\.risky/);
  assert.match(report, /100\.0%/);
  assert.match(report, /N\/A/);
  assert.ok(report.indexOf("risky") < report.indexOf("safe"));
});
