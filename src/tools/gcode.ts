import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export function registerGcodeTools(server: McpServer) {
  server.tool(
    "analyze_gcode",
    "Parse a GCode file and extract print estimates: time, filament usage, layer count, temperatures.",
    {
      gcode_path: z.string().describe("Absolute path to the GCode file"),
    },
    async ({ gcode_path }) => {
      try {
        if (!existsSync(gcode_path)) {
          return {
            content: [{ type: "text", text: `GCode file not found: ${gcode_path}` }],
            isError: true,
          };
        }

        const content = await readFile(gcode_path, "utf-8");
        const lines = content.split("\n");

        // Count layers
        let layers = 0;
        for (const line of lines) {
          if (line.startsWith(";LAYER_CHANGE") || line.startsWith("; LAYER_CHANGE")) {
            layers++;
          }
        }

        // Parse slicer comments
        let estimatedTime = "unknown";
        let filamentMm = 0;
        let filamentG = 0;
        let nozzleTemp = 0;
        let bedTemp = 0;
        let layerHeight = 0;
        let fillDensity = "";

        for (const line of lines) {
          const timeMatch = line.match(/;\s*estimated printing time.*?=\s*(.+)/i);
          if (timeMatch) estimatedTime = timeMatch[1].trim();

          const filMmMatch = line.match(/;\s*filament used\s*\[mm\]\s*=\s*([\d.]+)/i);
          if (filMmMatch) filamentMm = parseFloat(filMmMatch[1]);

          const filGMatch = line.match(/;\s*filament used\s*\[g\]\s*=\s*([\d.]+)/i);
          if (filGMatch) filamentG = parseFloat(filGMatch[1]);

          const tempMatch = line.match(/;\s*temperature\s*=\s*(\d+)/i);
          if (tempMatch) nozzleTemp = parseInt(tempMatch[1]);

          const bedMatch = line.match(/;\s*bed_temperature\s*=\s*(\d+)/i);
          if (bedMatch) bedTemp = parseInt(bedMatch[1]);

          const lhMatch = line.match(/;\s*layer_height\s*=\s*([\d.]+)/i);
          if (lhMatch) layerHeight = parseFloat(lhMatch[1]);

          const fillMatch = line.match(/;\s*fill_density\s*=\s*(.+)/i);
          if (fillMatch) fillDensity = fillMatch[1].trim();
        }

        const parts: string[] = [
          `GCode Analysis: ${gcode_path}`,
          ``,
          `Layers: ${layers}`,
          `Layer height: ${layerHeight || "unknown"} mm`,
          `Estimated time: ${estimatedTime}`,
          `Filament: ${filamentMm ? `${(filamentMm / 1000).toFixed(2)}m` : "unknown"} (${filamentG ? `${filamentG.toFixed(1)}g` : "unknown"})`,
          `Nozzle temp: ${nozzleTemp || "unknown"}\u00b0C`,
          `Bed temp: ${bedTemp || "unknown"}\u00b0C`,
          `Infill: ${fillDensity || "unknown"}`,
          `Total lines: ${lines.length}`,
        ];

        return { content: [{ type: "text", text: parts.join("\n") }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `GCode analysis failed: ${err}` }],
          isError: true,
        };
      }
    },
  );
}
