import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execTool } from "../lib/exec.js";
import { getConfig } from "../lib/config.js";

export function registerSliceTools(server: McpServer) {
  server.tool(
    "slice_model",
    "Slice an STL file into GCode for the AnkerMake M5. Uses eufyMake Studio (PrusaSlicer fork) with built-in M5 profiles.",
    {
      stl_path: z.string().describe("Absolute path to the STL file"),
      layer_height: z
        .number()
        .min(0.08)
        .max(0.32)
        .optional()
        .describe("Layer height in mm (0.08-0.32, default: profile default ~0.2)"),
      infill: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Infill density percentage (0-100)"),
      supports: z
        .boolean()
        .default(false)
        .describe("Enable support material"),
      nozzle_temp: z
        .number()
        .min(180)
        .max(260)
        .optional()
        .describe("Nozzle temperature in celsius"),
      bed_temp: z
        .number()
        .min(0)
        .max(110)
        .optional()
        .describe("Bed temperature in celsius"),
    },
    async ({ stl_path, layer_height, infill, supports, nozzle_temp, bed_temp }) => {
      try {
        if (!existsSync(stl_path)) {
          return {
            content: [{ type: "text", text: `STL file not found: ${stl_path}` }],
            isError: true,
          };
        }

        const config = getConfig();
        const baseName = path.basename(stl_path, path.extname(stl_path));
        const gcodeOut = path.join(config.workspaceDir, `${baseName}.gcode`);

        // Build profile load chain: base → printer → print
        const profileBase = path.join(config.slicerProfilesDir, "AnkerMake base", "base.ini");
        const profilePrinter = path.join(
          config.slicerProfilesDir,
          "AnkerMake M5",
          "0.4_nozzle",
          "printer.ini",
        );
        const profilePrint = path.join(
          config.slicerProfilesDir,
          "AnkerMake M5",
          "0.4_nozzle",
          "print.ini",
        );

        const args: string[] = [
          "--export-gcode",
          "--output", gcodeOut,
        ];

        // Load profiles if they exist
        for (const p of [profileBase, profilePrinter, profilePrint]) {
          if (existsSync(p)) {
            args.push("--load", p);
          }
        }

        // Apply overrides
        if (layer_height !== undefined) args.push("--layer-height", String(layer_height));
        if (infill !== undefined) args.push("--fill-density", `${infill}%`);
        if (supports) args.push("--support-material");
        if (nozzle_temp !== undefined) args.push("--temperature", String(nozzle_temp));
        if (bed_temp !== undefined) args.push("--bed-temperature", String(bed_temp));

        args.push(stl_path);

        console.error(`[slice] Running slicer: ${config.slicerPath} ${args.join(" ")}`);

        const result = await execTool(config.slicerPath, args, { timeout: 300_000 });

        if (result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Slicing failed (exit ${result.exitCode}):\n${result.stderr || result.stdout}`,
              },
            ],
            isError: true,
          };
        }

        // Parse gcode for estimates
        let estimatedTime = "unknown";
        let filamentUsed = "unknown";
        if (existsSync(gcodeOut)) {
          const gcode = await readFile(gcodeOut, "utf-8");
          const timeMatch = gcode.match(/;\s*estimated printing time.*?=\s*(.+)/i);
          if (timeMatch) estimatedTime = timeMatch[1].trim();
          const filMatch = gcode.match(/;\s*filament used\s*\[mm\]\s*=\s*([\d.]+)/i);
          if (filMatch) filamentUsed = `${(parseFloat(filMatch[1]) / 1000).toFixed(2)}m`;
        }

        return {
          content: [
            {
              type: "text",
              text:
                `Slicing complete!\n` +
                `GCode: ${gcodeOut}\n` +
                `Estimated time: ${estimatedTime}\n` +
                `Filament: ${filamentUsed}\n\n` +
                `Use send_print to upload and print, or analyze_gcode for more details.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Slicing failed: ${err}` }],
          isError: true,
        };
      }
    },
  );
}
