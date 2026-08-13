import type { CliArguments } from "./types.ts";

const DEFAULT_COVERAGE_PATH = "coverage/coverage-final.json";

export function parseCliArguments(args: string[]): CliArguments {
  const paths: string[] = [];
  let changed = false;
  let help = false;
  let coveragePath = DEFAULT_COVERAGE_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--changed") {
      changed = true;
    } else if (argument === "--coverage") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error("--coverage requires a path");
      }
      coveragePath = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      paths.push(argument);
    }
  }

  if (help && (changed || paths.length > 0)) {
    throw new Error("--help cannot be combined with other modes");
  }
  if (changed && paths.length > 0) {
    throw new Error("--changed cannot be combined with explicit paths");
  }

  if (help) {
    return { mode: "help", paths: [], coveragePath };
  }
  if (changed) {
    return { mode: "changed", paths: [], coveragePath };
  }
  if (paths.length > 0) {
    return { mode: "paths", paths, coveragePath };
  }
  return { mode: "all", paths: [], coveragePath };
}
