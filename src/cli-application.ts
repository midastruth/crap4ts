import { access } from "node:fs/promises";
import path from "node:path";

import { analyzeFiles } from "./analyzer.ts";
import { parseCliArguments } from "./cli-arguments.ts";
import { ProcessCommandExecutor } from "./command-executor.ts";
import { CoverageRunner } from "./coverage-runner.ts";
import type { CoverageGenerator } from "./coverage-runner.ts";
import { groupFilesByPackage } from "./package-grouper.ts";
import { formatReport } from "./report-formatter.ts";
import { detectChangedFiles, expandExplicitPaths, findDefaultSourceFiles } from "./source-file-finder.ts";
import type { MethodMetrics } from "./types.ts";

const CRAP_THRESHOLD = 8;

export interface CliContext {
  projectRoot: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  coverageRunner?: CoverageGenerator;
}

export async function runCli(args: string[], context: CliContext): Promise<number> {
  let parsed;
  try {
    parsed = parseCliArguments(args);
  } catch (error) {
    context.stderr(`${errorMessage(error)}\n`);
    context.stdout(usage());
    return 1;
  }

  if (parsed.mode === "help") {
    context.stdout(usage());
    return 0;
  }

  const files = parsed.mode === "all"
    ? await findDefaultSourceFiles(context.projectRoot)
    : parsed.mode === "changed"
      ? await detectChangedFiles(context.projectRoot)
      : await expandExplicitPaths(context.projectRoot, parsed.paths);

  if (files.length === 0) {
    context.stdout("No TypeScript files to analyze.\n");
    return 0;
  }

  const coverageRunner = context.coverageRunner ?? new CoverageRunner(new ProcessCommandExecutor());
  const groups = await groupFilesByPackage(context.projectRoot, files);
  const metrics: MethodMetrics[] = [];
  for (const group of groups) {
    const packageName = path.relative(context.projectRoot, group.packageRoot) || ".";
    context.stdout(`Generating coverage for ${packageName}...\n`);
    const coverageFile = await coverageRunner.generate(group.packageRoot, parsed.coveragePath, context.projectRoot);
    if (!await exists(coverageFile)) {
      context.stderr(`Warning: coverage file not found: ${coverageFile}; coverage will be N/A.\n`);
    }
    metrics.push(...await analyzeFiles(group.files, coverageFile));
  }
  context.stdout(formatReport(metrics, context.projectRoot));

  const maximum = maxCrap(metrics);
  if (maximum > CRAP_THRESHOLD) {
    context.stderr(`CRAP threshold exceeded: ${maximum.toFixed(2)} > ${CRAP_THRESHOLD.toFixed(2)}\n`);
    return 2;
  }
  return 0;
}

export function usage(): string {
  return `Usage:
  crap4ts                         Analyze TypeScript files under src/
  crap4ts --changed               Analyze changed TypeScript files under src/
  crap4ts <path...>               Analyze explicit files or directories
  crap4ts --coverage <file> [...] Set the package-relative Istanbul JSON destination
  crap4ts --help                  Print this help message
`;
}

function maxCrap(metrics: MethodMetrics[]): number {
  return metrics.reduce((maximum, metric) => metric.crapScore === null ? maximum : Math.max(maximum, metric.crapScore), 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
