import { readFile } from "node:fs/promises";
import path from "node:path";

import type { MethodDescriptor } from "./types.ts";

interface Position {
  line: number;
  column: number;
}

interface Location {
  start: Position;
  end: Position;
}

interface FunctionLocation {
  name: string;
  decl: { start: Position };
  loc: Location;
}

interface IstanbulFileCoverage {
  path: string;
  statementMap: Record<string, Location>;
  s: Record<string, number>;
  fnMap: Record<string, FunctionLocation>;
  f: Record<string, number>;
}

export type CoverageIndex = Map<string, IstanbulFileCoverage>;

export async function parseIstanbulCoverage(coverageFile: string): Promise<CoverageIndex> {
  let text: string;
  try {
    text = await readFile(coverageFile, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      return new Map();
    }
    throw error;
  }

  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid Istanbul coverage file: ${coverageFile}`);
  }

  const result: CoverageIndex = new Map();
  for (const [key, value] of Object.entries(parsed)) {
    if (!isRecord(value)) {
      continue;
    }
    const fileCoverage = value as unknown as IstanbulFileCoverage;
    const coveredPath = typeof fileCoverage.path === "string" ? fileCoverage.path : key;
    result.set(path.resolve(coveredPath), {
      path: coveredPath,
      statementMap: fileCoverage.statementMap ?? {},
      s: fileCoverage.s ?? {},
      fnMap: fileCoverage.fnMap ?? {},
      f: fileCoverage.f ?? {},
    });
  }
  return result;
}

export function coverageForMethod(index: CoverageIndex, method: MethodDescriptor): number | null {
  const fileCoverage = findFileCoverage(index, method.filePath);
  if (fileCoverage === undefined) {
    return null;
  }

  const statementIds = Object.entries(fileCoverage.statementMap)
    .filter(([, location]) => location.start.line >= method.startLine && location.end.line <= method.endLine)
    .map(([id]) => id);
  if (statementIds.length > 0) {
    const covered = statementIds.filter((id) => (fileCoverage.s[id] ?? 0) > 0).length;
    return covered / statementIds.length;
  }

  const functionId = nearestFunctionId(fileCoverage, method);
  if (functionId === null) {
    return null;
  }
  return (fileCoverage.f[functionId] ?? 0) > 0 ? 1 : 0;
}

function findFileCoverage(index: CoverageIndex, filePath: string): IstanbulFileCoverage | undefined {
  const absolute = path.resolve(filePath);
  const exact = index.get(absolute);
  if (exact !== undefined) {
    return exact;
  }

  const normalized = absolute.split(path.sep).join("/");
  const suffixMatches = [...index.entries()].filter(([candidate]) => {
    const normalizedCandidate = candidate.split(path.sep).join("/");
    return normalized.endsWith(`/${normalizedCandidate}`) || normalizedCandidate.endsWith(`/${normalized}`);
  });
  return suffixMatches.length === 1 ? suffixMatches[0][1] : undefined;
}

function nearestFunctionId(fileCoverage: IstanbulFileCoverage, method: MethodDescriptor): string | null {
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [id, entry] of Object.entries(fileCoverage.fnMap)) {
    const sameName = entry.name === method.name;
    const containsStart = entry.loc.start.line <= method.startLine && entry.loc.end.line >= method.startLine;
    if (!sameName && !containsStart) {
      continue;
    }
    const distance = Math.abs(entry.decl.start.line - method.startLine);
    if (distance < bestDistance) {
      bestId = id;
      bestDistance = distance;
    }
  }
  return bestId;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
