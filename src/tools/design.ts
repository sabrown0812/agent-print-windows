import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execTool } from "../lib/exec.js";
import { getConfig } from "../lib/config.js";

export function registerDesignTools(server: McpServer) {
  server.tool(
    "generate_scad",
    "Create a parametric 3D model using OpenSCAD code and render it to STL. Only available if OpenSCAD is installed.",
    {
      scad_code: z.string().describe("OpenSCAD source code for the model"),
      output_name: z
        .string()
        .default("model")
        .describe("Output file name (without extension)"),
      parameters: z
        .record(z.union([z.string(), z.number()]))
        .optional()
        .describe("OpenSCAD parameter overrides as key-value pairs"),
    },
    async ({ scad_code, output_name, parameters }) => {
      try {
        const config = getConfig();
        if (!config.openscadPath) {
          return {
            content: [
              {
                type: "text",
                text:
                  "OpenSCAD is not installed. Install from https://openscad.org/ to use design tools.\n\n" +
                  "Alternatively, you can create .scad files manually and render them after installing OpenSCAD.",
              },
            ],
            isError: true,
          };
        }

        await mkdir(config.workspaceDir, { recursive: true });
        const scadPath = path.join(config.workspaceDir, `${output_name}.scad`);
        const stlPath = path.join(config.workspaceDir, `${output_name}.stl`);

        await writeFile(scadPath, scad_code, "utf-8");

        const args = ["-o", stlPath];

        // Add parameter overrides
        if (parameters) {
          for (const [key, value] of Object.entries(parameters)) {
            const val = typeof value === "string" ? `"${value}"` : String(value);
            args.push("-D", `${key}=${val}`);
          }
        }

        args.push(scadPath);

        console.error(`[design] Rendering: ${scadPath} → ${stlPath}`);

        const result = await execTool(config.openscadPath, args, { timeout: 120_000 });

        if (result.exitCode !== 0 || !existsSync(stlPath)) {
          return {
            content: [
              {
                type: "text",
                text: `OpenSCAD render failed:\n${result.stderr || result.stdout}`,
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
                `Model rendered!\n` +
                `SCAD: ${scadPath}\n` +
                `STL: ${stlPath}\n\n` +
                `Use slice_model to slice it for printing.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Design failed: ${err}` }],
          isError: true,
        };
      }
    },
  );
}
