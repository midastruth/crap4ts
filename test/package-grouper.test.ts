import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { groupFilesByPackage } from "../src/package-grouper.ts";

test("groups files by their nearest package.json and preserves sorted order", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-packages-"));
  const packageA = path.join(root, "packages", "a");
  const packageB = path.join(root, "packages", "b");
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(packageA, "src"), { recursive: true });
  await mkdir(path.join(packageB, "src"), { recursive: true });
  await writeFile(path.join(root, "package.json"), "{}");
  await writeFile(path.join(packageA, "package.json"), "{}");
  await writeFile(path.join(packageB, "package.json"), "{}");
  const files = [
    path.join(packageB, "src", "b.ts"),
    path.join(root, "src", "root.ts"),
    path.join(packageA, "src", "z.ts"),
    path.join(packageA, "src", "a.ts"),
  ];

  const groups = await groupFilesByPackage(root, files);

  assert.deepEqual(groups, [
    { packageRoot: root, files: [path.join(root, "src", "root.ts")] },
    { packageRoot: packageA, files: [path.join(packageA, "src", "a.ts"), path.join(packageA, "src", "z.ts")] },
    { packageRoot: packageB, files: [path.join(packageB, "src", "b.ts")] },
  ]);
});

test("falls back to project root when no package.json exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crap4ts-packages-"));
  const file = path.join(root, "src", "sample.ts");
  await mkdir(path.dirname(file), { recursive: true });

  assert.deepEqual(await groupFilesByPackage(root, [file]), [{ packageRoot: root, files: [file] }]);
});
