import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { detectPackageManager, detectTestFramework } from "../src/package-runtime.ts";

test("packageManager field takes precedence over lockfiles", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runtime-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0", devDependencies: { vitest: "latest" } }));
  await writeFile(path.join(root, "package-lock.json"), "{}");

  assert.equal(await detectPackageManager(root), "pnpm");
  assert.equal(await detectTestFramework(root), "vitest");
});

test("detects Yarn and Jest from lockfile and test script", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runtime-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --conditions=test ./node_modules/jest/bin/jest.js" } }));
  await writeFile(path.join(root, "yarn.lock"), "");

  assert.equal(await detectPackageManager(root), "yarn");
  assert.equal(await detectTestFramework(root), "jest");
});

test("defaults to npm and reports an unsupported test setup", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runtime-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));

  assert.equal(await detectPackageManager(root), "npm");
  await assert.rejects(() => detectTestFramework(root), /Vitest or Jest/i);
});

test("workspace packages inherit package manager and test framework from the project root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runtime-"));
  const packageRoot = path.join(root, "packages", "web");
  await mkdir(packageRoot, { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@10", devDependencies: { vitest: "latest" } }));
  await writeFile(path.join(root, "pnpm-lock.yaml"), "");
  await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({ name: "web" }));

  assert.equal(await detectPackageManager(packageRoot, root), "pnpm");
  assert.equal(await detectTestFramework(packageRoot, root), "vitest");
});

test("rejects an explicitly configured unsupported package manager", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-runtime-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ packageManager: "bun@1.2.0", devDependencies: { vitest: "latest" } }));

  await assert.rejects(() => detectPackageManager(root), /Unsupported package manager.*bun/i);
});
