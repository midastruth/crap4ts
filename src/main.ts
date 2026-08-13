#!/usr/bin/env node

import { runCli } from "./cli-application.ts";

try {
  process.exitCode = await runCli(process.argv.slice(2), {
    projectRoot: process.cwd(),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
