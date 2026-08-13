import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { coverageForMethod, parseIstanbulCoverage } from "../src/istanbul-coverage.ts";
import type { MethodDescriptor } from "../src/types.ts";

test("derives fractional method coverage from statements inside the method", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-coverage-"));
  const sourceFile = path.join(root, "src", "sample.ts");
  const coverageFile = path.join(root, "coverage-final.json");
  await writeFile(coverageFile, JSON.stringify({
    [sourceFile]: {
      path: sourceFile,
      statementMap: {
        "0": { start: { line: 2, column: 2 }, end: { line: 2, column: 12 } },
        "1": { start: { line: 3, column: 2 }, end: { line: 3, column: 12 } },
        "2": { start: { line: 9, column: 2 }, end: { line: 9, column: 12 } }
      },
      s: { "0": 1, "1": 0, "2": 1 },
      fnMap: {},
      f: {}
    }
  }));
  const method: MethodDescriptor = {
    name: "sample",
    className: null,
    filePath: sourceFile,
    startLine: 1,
    endLine: 4,
    complexity: 1,
  };

  const coverage = await parseIstanbulCoverage(coverageFile);
  assert.equal(coverageForMethod(coverage, method), 0.5);
});

test("falls back to Istanbul function counters and returns null for unknown files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-coverage-"));
  const sourceFile = path.join(root, "src", "sample.ts");
  const coverageFile = path.join(root, "coverage-final.json");
  await writeFile(coverageFile, JSON.stringify({
    [sourceFile]: {
      path: sourceFile,
      statementMap: {},
      s: {},
      fnMap: {
        "0": { name: "sample", decl: { start: { line: 4, column: 0 } }, loc: { start: { line: 4, column: 0 }, end: { line: 6, column: 1 } } }
      },
      f: { "0": 3 }
    }
  }));
  const method: MethodDescriptor = {
    name: "sample",
    className: null,
    filePath: sourceFile,
    startLine: 4,
    endLine: 6,
    complexity: 1,
  };

  const coverage = await parseIstanbulCoverage(coverageFile);
  assert.equal(coverageForMethod(coverage, method), 1);
  assert.equal(coverageForMethod(coverage, { ...method, filePath: path.join(root, "missing.ts") }), null);
});
