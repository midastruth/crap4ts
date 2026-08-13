import assert from "node:assert/strict";
import test from "node:test";

import { ProcessCommandExecutor } from "../src/command-executor.ts";

test("process command executor waits for successful commands", async () => {
  await new ProcessCommandExecutor().execute(process.execPath, ["-e", "process.exit(0)"], process.cwd());
});

test("process command executor includes stderr when a command fails", async () => {
  await assert.rejects(
    () => new ProcessCommandExecutor().execute(
      process.execPath,
      ["-e", "process.stderr.write('coverage broke'); process.exit(3)"],
      process.cwd(),
    ),
    /Coverage command failed:.*coverage broke/s,
  );
});
