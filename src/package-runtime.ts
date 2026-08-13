import { access, readFile } from "node:fs/promises";
import path from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn";
export type TestFramework = "vitest" | "jest";

interface PackageJson {
  packageManager?: unknown;
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}

export async function detectPackageManager(packageRoot: string, projectRoot = packageRoot): Promise<PackageManager> {
  const roots = ancestorPackageRoots(packageRoot, projectRoot);
  for (const root of roots) {
    const packageJson = await readPackageJsonIfPresent(root);
    if (typeof packageJson?.packageManager === "string") {
      const name = packageJson.packageManager.split("@", 1)[0];
      if (name === "npm" || name === "pnpm" || name === "yarn") {
        return name;
      }
      throw new Error(`Unsupported package manager configured in ${root}: ${name}`);
    }
  }

  for (const root of roots) {
    if (await exists(path.join(root, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (await exists(path.join(root, "yarn.lock"))) {
      return "yarn";
    }
    if (await exists(path.join(root, "package-lock.json"))) {
      return "npm";
    }
  }
  return "npm";
}

export async function detectTestFramework(packageRoot: string, projectRoot = packageRoot): Promise<TestFramework> {
  for (const root of ancestorPackageRoots(packageRoot, projectRoot)) {
    const packageJson = await readPackageJsonIfPresent(root);
    if (packageJson === null) {
      continue;
    }
    const testScript = typeof packageJson.scripts?.test === "string" ? packageJson.scripts.test : "";
    if (/\bvitest\b/u.test(testScript)) {
      return "vitest";
    }
    if (/\bjest(?:\.js)?\b/u.test(testScript)) {
      return "jest";
    }

    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if ("vitest" in dependencies) {
      return "vitest";
    }
    if ("jest" in dependencies) {
      return "jest";
    }
  }
  throw new Error(`No supported test framework found in ${packageRoot}; install or configure Vitest or Jest`);
}

function ancestorPackageRoots(packageRoot: string, projectRoot: string): string[] {
  const start = path.resolve(packageRoot);
  const boundary = path.resolve(projectRoot);
  const relative = path.relative(boundary, start);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return [start];
  }

  const roots: string[] = [];
  let current = start;
  while (true) {
    roots.push(current);
    if (current === boundary) {
      break;
    }
    current = path.dirname(current);
  }
  return roots;
}

async function readPackageJsonIfPresent(packageRoot: string): Promise<PackageJson | null> {
  try {
    return await readPackageJson(packageRoot);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("package.json not found")) {
      return null;
    }
    throw error;
  }
}

async function readPackageJson(packageRoot: string): Promise<PackageJson> {
  const filePath = path.join(packageRoot, "package.json");
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      throw new Error(`package.json not found in ${packageRoot}`, { cause: error });
    }
    throw error;
  }

  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid package.json in ${packageRoot}`);
  }
  return value as PackageJson;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
