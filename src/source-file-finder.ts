import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const EXCLUDED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage", ".git", "test", "tests", "__tests__"]);

export async function findDefaultSourceFiles(projectRoot: string): Promise<string[]> {
  return collectWorkspaceSourceFiles(path.resolve(projectRoot));
}

export async function expandExplicitPaths(projectRoot: string, entries: string[]): Promise<string[]> {
  const files = new Set<string>();
  for (const entry of entries) {
    const absolute = path.resolve(projectRoot, entry);
    let details;
    try {
      details = await stat(absolute);
    } catch (error) {
      if (isMissingFile(error)) {
        continue;
      }
      throw error;
    }
    if (details.isFile() && isTypeScriptSource(absolute)) {
      files.add(absolute);
    } else if (details.isDirectory()) {
      for (const file of await collectSourceFiles(absolute)) {
        files.add(file);
      }
    }
  }
  return [...files].sort(comparePaths);
}

export async function detectChangedFiles(projectRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: projectRoot });
  return parseChangedFiles(projectRoot, stdout);
}

export function parseChangedFiles(projectRoot: string, statusOutput: string): string[] {
  const files = new Set<string>();
  for (const line of statusOutput.split(/\r?\n/u)) {
    if (line.length < 4) {
      continue;
    }
    const status = line.slice(0, 2);
    if (status.includes("D")) {
      continue;
    }
    let fileName = line.slice(3).trim();
    const renameSeparator = fileName.lastIndexOf(" -> ");
    if (renameSeparator >= 0) {
      fileName = fileName.slice(renameSeparator + 4);
    }
    fileName = unquoteGitPath(fileName);
    const normalized = fileName.split("\\").join("/");
    if (!isUnderSourceTree(normalized) || !isTypeScriptSource(normalized)) {
      continue;
    }
    files.add(path.resolve(projectRoot, fileName));
  }
  return [...files].sort(comparePaths);
}

function isUnderSourceTree(fileName: string): boolean {
  const segments = fileName.split("/");
  return segments.length > 1 && segments.slice(0, -1).includes("src");
}

async function collectSourceFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!shouldExcludeDirectory(entry.name)) {
        files.push(...await collectSourceFiles(absolute));
      }
    } else if (entry.isFile() && isTypeScriptSource(entry.name)) {
      files.push(absolute);
    }
  }
  return files.sort(comparePaths);
}

async function collectWorkspaceSourceFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || shouldExcludeDirectory(entry.name)) {
      continue;
    }
    const absolute = path.join(root, entry.name);
    if (entry.name === "src") {
      files.push(...await collectSourceFiles(absolute));
    } else {
      files.push(...await collectWorkspaceSourceFiles(absolute));
    }
  }
  return files.sort(comparePaths);
}

function shouldExcludeDirectory(directoryName: string): boolean {
  return EXCLUDED_DIRECTORIES.has(directoryName) || directoryName.startsWith(".");
}

function isTypeScriptSource(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (lower.endsWith(".ts") || lower.endsWith(".tsx"))
    && !lower.endsWith(".d.ts")
    && !lower.endsWith(".test.ts")
    && !lower.endsWith(".test.tsx")
    && !lower.endsWith(".spec.ts")
    && !lower.endsWith(".spec.tsx");
}

function unquoteGitPath(fileName: string): string {
  if (fileName.startsWith('"') && fileName.endsWith('"')) {
    return fileName.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
  }
  return fileName;
}

function comparePaths(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
