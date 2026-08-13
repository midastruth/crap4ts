# crap4ts Specification

## Purpose

`crap4ts` is a quality-gate CLI for TypeScript projects. It discovers TypeScript source files, generates package-local Istanbul JSON coverage, parses concrete functions with the TypeScript Compiler API, calculates CRAP scores, and prints the highest-risk functions first.

## File selection

- With no paths, find every directory named `src` beneath the project root and analyze its `.ts` and `.tsx` files recursively.
- With `--changed`, parse `git status --porcelain` and retain existing changed `.ts` and `.tsx` files beneath any `src/` tree.
- With explicit files or directories, analyze matching files and recursively expand directories.
- Deduplicate and sort all selected paths.
- Exclude `.d.ts`, `.test.ts[x]`, `.spec.ts[x]`, `node_modules`, `dist`, `build`, `coverage`, `.git`, and `__tests__`.
- An empty selection prints `No TypeScript files to analyze.` and succeeds.

## Function parsing

Report concrete function declarations, class methods, getters, setters, named function expressions, and arrows assigned to named variables or properties.

Ignore overload/ambient/interface/abstract declarations without bodies, constructors, and anonymous callbacks.

Each function starts at cyclomatic complexity 1. Add one for each `if`, loop, `catch`, switch `case` (including `default`), ternary expression, and short-circuit `&&`, `||`, or `??`. Branches in nested functions belong only to the nested function.

## Coverage

Group selected files by the nearest ancestor `package.json`, falling back to the project root. Process package groups sequentially and generate coverage once per group.

For every group:

1. Detect npm, pnpm, or Yarn using the nearest `packageManager` field, then the nearest `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`, and finally npm as the default.
2. Detect Vitest or Jest using the nearest package test script or dependency declaration.
3. Inherit detection configuration from ancestor packages up to the project root when necessary.
4. Delete stale package-local coverage output.
5. Execute the framework directly through the detected package manager with JSON coverage enabled.
6. Read `coverage/coverage-final.json` by default, or the package-relative destination given by `--coverage`.

Reject unsupported explicitly configured package managers and coverage destinations outside the package. Fail fast when the test command fails. If the command succeeds without producing JSON, warn and continue with `N/A` coverage.

For each function, coverage is the fraction of covered Istanbul statements fully contained in its source line range. If it has no mapped statements, use the nearest matching Istanbul function counter. If neither is available, coverage is `N/A`.

Vitest and Jest are supported. Node's built-in test coverage is not accepted because it does not produce Istanbul `coverage-final.json`.

## Score and report

For known coverage:

```text
CRAP = CC^2 * (1 - coverage)^3 + CC
```

Sort numeric scores descending and put `N/A` scores last. The report includes method name, file, complexity, coverage, and CRAP score.

## Threshold and exits

The fixed threshold is `8.0`.

- Exit `0` for help, an empty selection, or a maximum score at or below the threshold.
- Exit `1` for invalid arguments or fatal analysis errors.
- Exit `2` and print a threshold error when the maximum numeric score is greater than `8.0`.
