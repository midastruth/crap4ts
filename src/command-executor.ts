import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CommandExecutor {
  execute(command: string, args: string[], cwd: string): Promise<void>;
}

export class ProcessCommandExecutor implements CommandExecutor {
  async execute(command: string, args: string[], cwd: string): Promise<void> {
    try {
      await execFileAsync(command, args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    } catch (error) {
      throw new Error(commandFailure(command, args, error), { cause: error });
    }
  }
}

function commandFailure(command: string, args: string[], error: unknown): string {
  const detail = error instanceof Error && "stderr" in error && typeof error.stderr === "string"
    ? error.stderr.trim()
    : error instanceof Error
      ? error.message
      : String(error);
  return `Coverage command failed: ${[command, ...args].join(" ")}${detail.length > 0 ? `\n${detail}` : ""}`;
}
