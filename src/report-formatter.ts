import path from "node:path";

import type { MethodMetrics } from "./types.ts";

export function sortMetrics(metrics: MethodMetrics[]): MethodMetrics[] {
  return [...metrics].sort((left, right) => {
    if (left.crapScore === null && right.crapScore === null) {
      return methodLabel(left).localeCompare(methodLabel(right));
    }
    if (left.crapScore === null) {
      return 1;
    }
    if (right.crapScore === null) {
      return -1;
    }
    return right.crapScore - left.crapScore || methodLabel(left).localeCompare(methodLabel(right));
  });
}

export function formatReport(metrics: MethodMetrics[], projectRoot: string): string {
  const rows = sortMetrics(metrics).map((metric) => [
    methodLabel(metric),
    path.relative(projectRoot, metric.filePath) || path.basename(metric.filePath),
    String(metric.complexity),
    metric.coverage === null ? "N/A" : `${(metric.coverage * 100).toFixed(1)}%`,
    metric.crapScore === null ? "N/A" : metric.crapScore.toFixed(2),
  ]);
  const headers = ["Method", "File", "CC", "Coverage", "CRAP"];
  const widths = headers.map((header, column) => Math.max(header.length, ...rows.map((row) => row[column].length)));
  const render = (row: string[]): string => row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd();
  return `${render(headers)}\n${widths.map((width) => "-".repeat(width)).join("  ")}\n${rows.map(render).join("\n")}\n`;
}

function methodLabel(metric: MethodMetrics): string {
  return metric.className === null ? metric.name : `${metric.className}.${metric.name}`;
}
