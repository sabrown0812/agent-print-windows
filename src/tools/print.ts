import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { execTool } from "../lib/exec.js";
import { getConfig } from "../lib/config.js";

export function registerPrintTools(server: McpServer) {
  server.tool(
    "send_print",
    "Upload a GCode file to the AnkerMake M5 and start printing. WARNING: This will physically move the printer and extrude filament. Use dry_run=true to test upload without printing.",
    {
      gcode_path: z.string().describe("Absolute path to the GCode file"),
      dry_run: z
        .boolean()
        .default(false)
        .describe("If true, upload only without starting the print"),
    },
    async ({ gcode_path, dry_run }) => {
      try {
        if (!existsSync(gcode_path)) {
          return {
            content: [{ type: "text", text: `GCode file not found: ${gcode_path}` }],
            isError: true,
          };
        }

        const config = getConfig();
        const args = [config.ankerctlPath, "pppp", "print-file"];
        if (dry_run) args.push("--no-act");
        args.push(gcode_path);

        console.error(`[print] ${dry_run ? "Dry run" : "Sending"}: ${gcode_path}`);

        const result = await execTool(config.pythonPath, args, { timeout: 600_000 });

        if (result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Print failed (exit ${result.exitCode}):\n${result.stderr || result.stdout}`,
              },
            ],
            isError: true,
          };
        }

        const status = dry_run ? "uploaded (dry run - not printing)" : "uploaded and printing";
        return {
          content: [
            {
              type: "text",
              text:
                `Print ${status}!\n\n${result.stdout}\n\n` +
                `Use printer_status to monitor progress.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Print failed: ${err}` }],
          isError: true,
        };
      }
    },
  );
}
