import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execTool } from "../lib/exec.js";
import { getConfig } from "../lib/config.js";

function ankerctl(...subArgs: string[]) {
  const config = getConfig();
  return execTool(config.pythonPath, [config.ankerctlPath, ...subArgs], {
    timeout: 15_000,
  });
}

export function registerPrinterTools(server: McpServer) {
  server.tool(
    "printer_status",
    "Get current AnkerMake M5 printer status by monitoring MQTT events for a few seconds. Shows temperature, print progress, and state.",
    {},
    async () => {
      try {
        // mqtt monitor streams events until killed — use a short timeout
        const result = await execTool(
          getConfig().pythonPath,
          [getConfig().ankerctlPath, "mqtt", "monitor"],
          { timeout: 8_000 },
        );

        // Even on timeout (exit code != 0), we may have captured useful output
        const output = result.stdout || result.stderr;
        if (!output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: "No MQTT events received. The printer may be off, disconnected, or idle.\n\nMake sure the printer is on and connected to the same network.",
              },
            ],
          };
        }

        // Parse MQTT events for status info
        const parsed = parseMqttOutput(output);
        return { content: [{ type: "text", text: parsed }] };
      } catch (err) {
        // Timeout is expected — mqtt monitor runs forever
        const errStr = String(err);
        if (errStr.includes("ETIMEDOUT") || errStr.includes("killed")) {
          return {
            content: [
              {
                type: "text",
                text: "MQTT monitor timed out with no events. Printer may be off or disconnected.",
              },
            ],
          };
        }
        return {
          content: [{ type: "text", text: `Status check failed: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "printer_gcode",
    "Send a raw GCode command to the printer via MQTT and get the response. Use for simple commands like G28 (home), M105 (temps), M114 (position).",
    {
      command: z.string().describe("GCode command to send (e.g. 'M105', 'G28', 'M114')"),
    },
    async ({ command }) => {
      try {
        // Use mqtt gcode but it's interactive — we'll use mqtt send instead
        // Actually, gcode is interactive. Let's use a simpler approach:
        // echo the command into the gcode subcommand
        const config = getConfig();
        const result = await execTool(
          config.pythonPath,
          [config.ankerctlPath, "mqtt", "send", "ZZ_MQTT_CMD_GCODE_COMMAND", `gcode=${command}`],
          { timeout: 10_000 },
        );

        return {
          content: [
            {
              type: "text",
              text: result.stdout || result.stderr || "Command sent (no response captured).",
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `GCode command failed: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "pause_print",
    "Pause the current print job on the AnkerMake M5.",
    {},
    async () => {
      try {
        const result = await ankerctl("mqtt", "send", "-f", "ZZ_MQTT_CMD_PRINT_CTRL", "value=pause");
        return {
          content: [
            { type: "text", text: `Pause command sent.\n${result.stdout || result.stderr}` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Pause failed: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "resume_print",
    "Resume a paused print job on the AnkerMake M5.",
    {},
    async () => {
      try {
        const result = await ankerctl("mqtt", "send", "-f", "ZZ_MQTT_CMD_PRINT_CTRL", "value=resume");
        return {
          content: [
            { type: "text", text: `Resume command sent.\n${result.stdout || result.stderr}` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Resume failed: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "cancel_print",
    "Cancel the current print job on the AnkerMake M5. WARNING: This will stop the print and it cannot be resumed.",
    {},
    async () => {
      try {
        const result = await ankerctl("mqtt", "send", "-f", "ZZ_MQTT_CMD_PRINT_CTRL", "value=cancel");
        return {
          content: [
            { type: "text", text: `Cancel command sent.\n${result.stdout || result.stderr}` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Cancel failed: ${err}` }],
          isError: true,
        };
      }
    },
  );
}

function parseMqttOutput(raw: string): string {
  const lines = raw.split("\n").filter((l) => l.trim());
  const parts: string[] = ["Printer MQTT Events:"];

  // Look for temperature, progress, and state info in the raw output
  let foundData = false;
  for (const line of lines) {
    // Extract useful fields from MQTT messages
    if (line.includes("nozzle_temp") || line.includes("hotend")) {
      parts.push(`  Nozzle: ${extractValue(line)}`);
      foundData = true;
    }
    if (line.includes("bed_temp") || line.includes("platform_temp")) {
      parts.push(`  Bed: ${extractValue(line)}`);
      foundData = true;
    }
    if (line.includes("progress") || line.includes("print_progress")) {
      parts.push(`  Progress: ${extractValue(line)}`);
      foundData = true;
    }
    if (line.includes("print_status") || line.includes("state")) {
      parts.push(`  State: ${extractValue(line)}`);
      foundData = true;
    }
    if (line.includes("layer") || line.includes("current_layer")) {
      parts.push(`  Layer: ${extractValue(line)}`);
      foundData = true;
    }
  }

  if (!foundData) {
    parts.push("\nRaw output:");
    // Show first 30 lines of raw output
    parts.push(...lines.slice(0, 30));
    if (lines.length > 30) parts.push(`... (${lines.length - 30} more lines)`);
  }

  return parts.join("\n");
}

function extractValue(line: string): string {
  // Try to get the value portion after = or :
  const match = line.match(/[=:]\s*(.+?)(?:\s*[,}]|$)/);
  return match ? match[1].trim() : line.trim();
}
