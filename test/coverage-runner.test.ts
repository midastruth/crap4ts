import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { CoverageRunner } from "../src/coverage-runner.ts";
import type { CommandExecutor } from "../src/command-executor.ts";

test("cleans stale coverage and runs Vitest through npm", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runner-"));
  const report = path.join(root, "coverage", "coverage-final.json");
  await mkdir(path.dirname(report));
  await writeFile(report, "stale");
  await writeFile(path.join(root, "package.json"), JSON.stringify({ devDependencies: { vitest: "latest" } }));
  await writeFile(path.join(root, "package-lock.json"), "{}");
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const executor: CommandExecutor = {
    async execute(command, args, cwd) {
      await assert.rejects(() => access(report));
      calls.push({ command, args, cwd });
      await mkdir(path.dirname(report), { recursive: true });
      await writeFile(report, "{}");
    },
  };

  const result = await new CoverageRunner(executor).generate(root, "coverage/coverage-final.json");

  assert.equal(result, report);
  assert.deepEqual(calls, [{
    command: "npm",
    args: ["exec", "--", "vitest", "run", "--root=.", "--coverage", "--coverage.reporter=json", "--coverage.reportsDirectory=coverage"],
    cwd: root,
  }]);
});

test("runs Jest through pnpm with an isolated report directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runner-"));
  const report = path.join(root, "artifacts", "coverage-final.json");
  await writeFile(path.join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@10", devDependencies: { jest: "latest" } }));
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const executor: CommandExecutor = {
    async execute(command, args, cwd) {
      calls.push({ command, args, cwd });
      await mkdir(path.dirname(report), { recursive: true });
      await writeFile(report, "{}");
    },
  };

  await new CoverageRunner(executor).generate(root, "artifacts/coverage-final.json");

  assert.deepEqual(calls[0], {
    command: "pnpm",
    args: ["exec", "jest", "--rootDir=.", "--coverage", "--coverageReporters=json", "--coverageDirectory=artifacts"],
    cwd: root,
  });
});

test("rejects coverage destinations outside the package", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runner-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ devDependencies: { vitest: "latest" } }));
  const executor: CommandExecutor = { async execute() {} };

  await assert.rejects(() => new CoverageRunner(executor).generate(root, "../coverage-final.json"), /inside the package/i);
});

test("returns the expected path when the test command produces no Istanbul JSON", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runner-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ devDependencies: { vitest: "latest" } }));
  const executor: CommandExecutor = { async execute() {} };

  const report = await new CoverageRunner(executor).generate(root, "coverage/coverage-final.json");
  assert.equal(report, path.join(root, "coverage", "coverage-final.json"));
  await assert.rejects(() => access(report));
});
