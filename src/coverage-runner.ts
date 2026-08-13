import { rm } from "node:fs/promises";
import path from "node:path";

import type { CommandExecutor } from "./command-executor.ts";
import { detectPackageManager, detectTestFramework } from "./package-runtime.ts";
import type { PackageManager, TestFramework } from "./package-runtime.ts";

export interface CoverageGenerator {
  generate(packageRoot: string, coveragePath: string, projectRoot?: string): Promise<string>;
}

export class CoverageRunner implements CoverageGenerator {
  private readonly executor: CommandExecutor;

  constructor(executor: CommandExecutor) {
    this.executor = executor;
  }

  async generate(packageRoot: string, coveragePath: string, projectRoot = packageRoot): Promise<string> {
    const normalizedRoot = path.resolve(packageRoot);
    const reportPath = resolveReportPath(normalizedRoot, coveragePath);
    const reportDirectory = path.dirname(reportPath);
    await cleanStaleCoverage(normalizedRoot, reportPath);

    const packageManager = await detectPackageManager(normalizedRoot, projectRoot);
    const testFramework = await detectTestFramework(normalizedRoot, projectRoot);
    const relativeDirectory = toPortablePath(path.relative(normalizedRoot, reportDirectory) || ".");
    const { command, args } = coverageCommand(packageManager, testFramework, relativeDirectory);
    await this.executor.execute(command, args, normalizedRoot);

    return reportPath;
  }
}

function resolveReportPath(packageRoot: string, coveragePath: string): string {
  if (path.isAbsolute(coveragePath)) {
    throw new Error("Coverage path must be relative and inside the package");
  }
  const reportPath = path.resolve(packageRoot, coveragePath);
  const relative = path.relative(packageRoot, reportPath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Coverage path must be inside the package");
  }
  return reportPath;
}

async function cleanStaleCoverage(packageRoot: string, reportPath: string): Promise<void> {
  const defaultReport = path.join(packageRoot, "coverage", "coverage-final.json");
  if (reportPath === defaultReport) {
    await rm(path.dirname(reportPath), { recursive: true, force: true });
  } else {
    await rm(reportPath, { force: true });
  }
}

function coverageCommand(
  packageManager: PackageManager,
  testFramework: TestFramework,
  reportDirectory: string,
): { command: string; args: string[] } {
  const executableArgs = testFramework === "vitest"
    ? ["vitest", "run", "--root=.", "--coverage", "--coverage.reporter=json", `--coverage.reportsDirectory=${reportDirectory}`]
    : ["jest", "--rootDir=.", "--coverage", "--coverageReporters=json", `--coverageDirectory=${reportDirectory}`];

  if (packageManager === "npm") {
    return { command: "npm", args: ["exec", "--", ...executableArgs] };
  }
  return { command: packageManager, args: ["exec", ...executableArgs] };
}

function toPortablePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
