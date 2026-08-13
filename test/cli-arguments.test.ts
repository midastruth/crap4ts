import assert from "node:assert/strict";
import test from "node:test";

import { parseCliArguments } from "../src/cli-arguments.ts";

test("parses all supported CLI forms", () => {
  assert.deepEqual(parseCliArguments([]), { mode: "all", paths: [], coveragePath: "coverage/coverage-final.json" });
  assert.deepEqual(parseCliArguments(["--changed"]), { mode: "changed", paths: [], coveragePath: "coverage/coverage-final.json" });
  assert.deepEqual(parseCliArguments(["src/a.ts", "packages/app"]), { mode: "paths", paths: ["src/a.ts", "packages/app"], coveragePath: "coverage/coverage-final.json" });
  assert.deepEqual(parseCliArguments(["--coverage", "artifacts/coverage.json", "src"]), { mode: "paths", paths: ["src"], coveragePath: "artifacts/coverage.json" });
  assert.deepEqual(parseCliArguments(["--help"]), { mode: "help", paths: [], coveragePath: "coverage/coverage-final.json" });
});

test("rejects conflicting or incomplete options", () => {
  assert.throws(() => parseCliArguments(["--changed", "src/a.ts"]), /cannot be combined/i);
  assert.throws(() => parseCliArguments(["--coverage"]), /requires a path/i);
  assert.throws(() => parseCliArguments(["--wat"]), /unknown option/i);
});
