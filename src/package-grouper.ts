import { access } from "node:fs/promises";
import path from "node:path";

export interface PackageGroup {
  packageRoot: string;
  files: string[];
}

export async function groupFilesByPackage(projectRoot: string, files: string[]): Promise<PackageGroup[]> {
  const normalizedRoot = path.resolve(projectRoot);
  const grouped = new Map<string, string[]>();

  for (const file of files) {
    const absoluteFile = path.resolve(file);
    const packageRoot = await nearestPackageRoot(normalizedRoot, path.dirname(absoluteFile));
    const packageFiles = grouped.get(packageRoot) ?? [];
    packageFiles.push(absoluteFile);
    grouped.set(packageRoot, packageFiles);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => comparePaths(left, right))
    .map(([packageRoot, packageFiles]) => ({
      packageRoot,
      files: [...new Set(packageFiles)].sort(comparePaths),
    }));
}

async function nearestPackageRoot(projectRoot: string, start: string): Promise<string> {
  let current = path.resolve(start);
  while (isWithin(projectRoot, current)) {
    if (await exists(path.join(current, "package.json"))) {
      return current;
    }
    if (current === projectRoot) {
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return projectRoot;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function comparePaths(left: string, right: string): number {
  return left.localeCompare(right, "en");
}
