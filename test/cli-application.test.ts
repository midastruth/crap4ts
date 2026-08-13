import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCli, usage } from "../src/cli-application.ts";
import type { CoverageGenerator } from "../src/coverage-runner.ts";

test("help prints usage and succeeds", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(["--help"], { projectRoot: "/project", stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) });
  assert.equal(code, 0);
  assert.equal(stderr.length, 0);
  assert.equal(stdout.join(""), usage());
});

test("empty selection succeeds without requiring coverage", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-cli-"));
  await mkdir(path.join(root, "src"));
  const stdout: string[] = [];
  const code = await runCli([], { projectRoot: root, stdout: (text) => stdout.push(text), stderr: () => {} });
  assert.equal(code, 0);
  assert.match(stdout.join(""), /No TypeScript files to analyze/);
});

test("returns 2 when the maximum CRAP score exceeds 8", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-cli-"));
  const sourceFile = path.join(root, "src", "risky.ts");
  const coverageFile = path.join(root, "coverage", "coverage-final.json");
  await mkdir(path.dirname(sourceFile), { recursive: true });
  await mkdir(path.dirname(coverageFile), { recursive: true });
  await writeFile(sourceFile, `export function risky(a: boolean, b: boolean) {
    if (a) return 1;
    if (b) return 2;
    return 0;
  }`);
  await writeFile(coverageFile, JSON.stringify({
    [sourceFile]: {
      path: sourceFile,
      statementMap: {
        "0": { start: { line: 2, column: 4 }, end: { line: 2, column: 20 } },
        "1": { start: { line: 3, column: 4 }, end: { line: 3, column: 20 } },
        "2": { start: { line: 4, column: 4 }, end: { line: 4, column: 13 } }
      },
      s: { "0": 0, "1": 0, "2": 0 }, fnMap: {}, f: {}
    }
  }));
  const stdout: string[] = [];
  const stderr: string[] = [];

  const coverageRunner: CoverageGenerator = { async generate() { return coverageFile; } };
  const code = await runCli([], { projectRoot: root, stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text), coverageRunner });
  assert.equal(code, 2);
  assert.match(stdout.join(""), /risky/);
  assert.match(stderr.join(""), /CRAP threshold exceeded: 12\.00 > 8\.00/);
});

test("generates coverage once for each package before analyzing it", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-cli-"));
  const packages = [path.join(root, "packages", "a"), path.join(root, "packages", "b")];
  for (const packageRoot of packages) {
    await mkdir(path.join(packageRoot, "src"), { recursive: true });
    await mkdir(path.join(packageRoot, "coverage"), { recursive: true });
    await writeFile(path.join(packageRoot, "package.json"), "{}");
    await writeFile(path.join(packageRoot, "src", "index.ts"), "export function value() { return 1; }");
    await writeFile(path.join(packageRoot, "coverage", "coverage-final.json"), "{}");
  }
  const generated: string[] = [];
  const coverageRunner: CoverageGenerator = {
    async generate(packageRoot, coveragePath) {
      generated.push(packageRoot);
      return path.join(packageRoot, coveragePath);
    },
  };

  const code = await runCli([], { projectRoot: root, stdout: () => {}, stderr: () => {}, coverageRunner });

  assert.equal(code, 0);
  assert.deepEqual(generated, packages);
});

test("warns and reports N/A when a successful test run produces no coverage JSON", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-cli-"));
  const sourceFile = path.join(root, "src", "sample.ts");
  await mkdir(path.dirname(sourceFile), { recursive: true });
  await writeFile(path.join(root, "package.json"), "{}");
  await writeFile(sourceFile, "export function sample() { return 1; }");
  const missingCoverage = path.join(root, "coverage", "coverage-final.json");
  const coverageRunner: CoverageGenerator = { async generate() { return missingCoverage; } };
  const stdout: string[] = [];
  const stderr: string[] = [];

  const code = await runCli([], {
    projectRoot: root,
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    coverageRunner,
  });

  assert.equal(code, 0);
  assert.match(stdout.join(""), /sample.*N\/A/s);
  assert.match(stderr.join(""), /coverage file not found/i);
});

test("invalid CLI usage returns 1 and prints help", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(["--unknown"], { projectRoot: "/project", stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) });
  assert.equal(code, 1);
  assert.match(stderr.join(""), /Unknown option/);
  assert.equal(stdout.join(""), usage());
});
