export interface MethodDescriptor {
  name: string;
  className: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  complexity: number;
}

export interface MethodMetrics {
  name: string;
  className: string | null;
  filePath: string;
  complexity: number;
  coverage: number | null;
  crapScore: number | null;
}

export type CliMode = "all" | "changed" | "paths" | "help";

export interface CliArguments {
  mode: CliMode;
  paths: string[];
  coveragePath: string;
}
