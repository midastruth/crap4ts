import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { findDefaultSourceFiles, expandExplicitPaths, parseChangedFiles } from "../src/source-file-finder.ts";

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-sources-"));
  await mkdir(path.join(root, "src", "nested"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(path.join(root, "src", "a.ts"), "export const a = 1;");
  await writeFile(path.join(root, "src", "b.tsx"), "export const b = <b />;");
  await writeFile(path.join(root, "src", "types.d.ts"), "declare const value: string;");
  await writeFile(path.join(root, "src", "nested", "c.js"), "export const c = 1;");
  await writeFile(path.join(root, "dist", "generated.ts"), "export const generated = 1;");
  return root;
}

test("default discovery includes ts and tsx under src and excludes declarations", async () => {
  const root = await fixture();
  const files = await findDefaultSourceFiles(root);
  assert.deepEqual(files.map((file) => path.relative(root, file)), ["src/a.ts", "src/b.tsx"]);
});

test("default discovery includes src trees in workspace packages", async () => {
  const root = await fixture();
  const packageSource = path.join(root, "packages", "web", "src");
  await mkdir(packageSource, { recursive: true });
  await writeFile(path.join(packageSource, "app.ts"), "export const app = 1;");
  await mkdir(path.join(root, "examples", "not-source"), { recursive: true });
  await writeFile(path.join(root, "examples", "not-source", "ignored.ts"), "export const ignored = 1;");

  const files = await findDefaultSourceFiles(root);

  assert.deepEqual(files.map((file) => path.relative(root, file)), ["packages/web/src/app.ts", "src/a.ts", "src/b.tsx"]);
});

test("explicit directories are searched directly and results are deduplicated", async () => {
  const root = await fixture();
  const files = await expandExplicitPaths(root, ["src", "src/a.ts"]);
  assert.deepEqual(files.map((file) => path.relative(root, file)), ["src/a.ts", "src/b.tsx"]);
});

test("changed-file parsing handles rename records and filters outside src", () => {
  const status = [
    " M src/a.ts",
    "?? src/new.tsx",
    "R  src/old.ts -> src/renamed.ts",
    " M README.md",
    " M dist/generated.ts",
    " M packages/web/src/view.tsx",
    " D src/deleted.ts",
  ].join("\n");

  assert.deepEqual(parseChangedFiles("/project", status), [
    "/project/packages/web/src/view.tsx",
    "/project/src/a.ts",
    "/project/src/new.tsx",
    "/project/src/renamed.ts",
  ]);
});
