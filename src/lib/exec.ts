import { execFile } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function execTool(
  command: string,
  args: string[],
  options?: { timeout?: number; cwd?: string },
): Promise<ExecResult> {
  const timeout = options?.timeout ?? 60_000;
  return new Promise((resolve, reject) => {
    const proc = execFile(
      command,
      args,
      {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf-8",
        cwd: options?.cwd,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error && !("code" in error)) {
          reject(error);
          return;
        }
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          exitCode: proc.exitCode ?? (error ? 1 : 0),
        });
      },
    );
  });
}
