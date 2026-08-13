import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeFiles } from "../src/analyzer.ts";

test("combines parsed complexity with Istanbul coverage", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-analyzer-"));
  const sourceFile = path.join(root, "src", "sample.ts");
  const coverageFile = path.join(root, "coverage", "coverage-final.json");
  await mkdir(path.dirname(sourceFile), { recursive: true });
  await mkdir(path.dirname(coverageFile), { recursive: true });
  await writeFile(sourceFile, "export function sample(value: boolean) {\n  if (value) return 1;\n  return 0;\n}\n");
  await writeFile(coverageFile, JSON.stringify({
    [sourceFile]: {
      path: sourceFile,
      statementMap: {
        "0": { start: { line: 2, column: 2 }, end: { line: 2, column: 21 } },
        "1": { start: { line: 3, column: 2 }, end: { line: 3, column: 11 } }
      },
      s: { "0": 1, "1": 0 },
      fnMap: {},
      f: {}
    }
  }));

  const [metric] = await analyzeFiles([sourceFile], coverageFile);
  assert.equal(metric.name, "sample");
  assert.equal(metric.complexity, 2);
  assert.equal(metric.coverage, 0.5);
  assert.equal(metric.crapScore, 2.5);
});

test("reports null coverage and score when coverage JSON is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-analyzer-"));
  const sourceFile = path.join(root, "sample.ts");
  await writeFile(sourceFile, "export function sample() { return 1; }");

  const [metric] = await analyzeFiles([sourceFile], path.join(root, "missing.json"));
  assert.equal(metric.coverage, null);
  assert.equal(metric.crapScore, null);
});
