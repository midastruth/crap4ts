# crap4ts

`crap4ts` is a standalone CRAP metric analyzer for TypeScript projects.

It combines per-function cyclomatic complexity with Istanbul statement coverage and reports the riskiest functions first.

## Formula

```text
CRAP = CC^2 * (1 - coverage)^3 + CC
```

- `CC` is cyclomatic complexity calculated from the TypeScript AST.
- `coverage` is the fraction of covered Istanbul statements inside a function.

## Supported code

The parser uses the TypeScript Compiler API and supports `.ts` and `.tsx` files. It reports:

- function declarations
- class methods and accessors
- named function expressions
- arrow functions assigned to named variables or properties

It excludes declarations without bodies, constructors, anonymous callbacks, declaration files, and test/spec files.

## Coverage pipeline

Like the original `crap4java`, `crap4ts` generates fresh coverage on every invocation:

1. Group selected files by their nearest `package.json`.
2. Detect npm, pnpm, or Yarn from `packageManager` and lockfiles.
3. Detect Vitest or Jest from the package test script and dependencies.
4. Delete the stale package-local coverage output.
5. Run the detected test framework with Istanbul JSON reporting.
6. Read `coverage/coverage-final.json` and analyze that package.

Workspace packages inherit package-manager and test-framework configuration from the project root when it is not declared locally. Package groups run sequentially.

The generated commands are equivalent to:

```bash
npm exec -- vitest run --root=. --coverage --coverage.reporter=json --coverage.reportsDirectory=coverage
npm exec -- jest --rootDir=. --coverage --coverageReporters=json --coverageDirectory=coverage
```

The executable changes to `pnpm exec` or `yarn exec` when detected.

Use another package-relative output location with:

```bash
crap4ts --coverage artifacts/coverage-final.json
```

For the default destination, the package's complete `coverage/` directory is removed before testing. For a custom destination, only the exact JSON file is removed. Paths outside a package are rejected.

If the tests succeed but coverage JSON is absent, analysis continues with coverage and CRAP reported as `N/A`. A failed test command stops the analysis.

## Install and develop

```bash
npm install
npm test
npm run check
npm run build
```

## CLI

```text
crap4ts                         Analyze TypeScript files under src/
crap4ts --changed               Analyze changed TypeScript files under src/
crap4ts <path...>               Analyze explicit files or directories
crap4ts --coverage <file> [...] Set the package-relative Istanbul JSON destination
crap4ts --help                  Print help
```

Default discovery finds every `src/` tree in the project, including workspace packages. Explicit directories are searched recursively. Generated directories, dependency directories, declaration files, and common test/spec files are excluded.

## Exit codes

- `0`: analysis succeeded and the threshold was respected
- `1`: invalid CLI usage or an analysis error
- `2`: maximum CRAP score exceeded `8.0`
