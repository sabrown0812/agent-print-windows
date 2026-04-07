import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { execTool } from "../lib/exec.js";
import { getConfig } from "../lib/config.js";

export function registerCameraTools(server: McpServer) {
  server.tool(
    "capture_snapshot",
    "Capture a short video clip from the AnkerMake M5 camera. Saves as H.264 file. Requires ffmpeg to extract frames.",
    {
      output_name: z
        .string()
        .default("snapshot")
        .describe("Output file name (without extension)"),
    },
    async ({ output_name }) => {
      try {
        const config = getConfig();
        await mkdir(config.workspaceDir, { recursive: true });

        const outPath = path.join(config.workspaceDir, `${output_name}.h264`);

        console.error(`[camera] Capturing to ${outPath}`);

        const result = await execTool(
          config.pythonPath,
          [
            config.ankerctlPath,
            "pppp",
            "capture-video",
            "--max-size",
            "500kb",
            outPath,
          ],
          { timeout: 30_000 },
        );

        if (result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Camera capture failed (exit ${result.exitCode}):\n${result.stderr || result.stdout}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text:
                `Camera capture saved to: ${outPath}\n\n` +
                `This is an H.264 elementary stream. To extract a frame:\n` +
                `  ffmpeg -i "${outPath}" -frames:v 1 "${outPath.replace(".h264", ".jpg")}"\n\n` +
                `To play:\n` +
                `  ffplay "${outPath}"`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Camera capture failed: ${err}` }],
          isError: true,
        };
      }
    },
  );
}
