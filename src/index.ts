import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./lib/config.js";
import { registerSearchTools } from "./tools/search.js";
import { registerDownloadTools } from "./tools/download.js";
import { registerSliceTools } from "./tools/slice.js";
import { registerGcodeTools } from "./tools/gcode.js";
import { registerPrintTools } from "./tools/print.js";
import { registerPrinterTools } from "./tools/printer.js";
import { registerCameraTools } from "./tools/camera.js";
import { registerDesignTools } from "./tools/design.js";

const server = new McpServer(
  {
    name: "agent-printer",
    version: "0.1.0",
  },
  {
    instructions:
      "Controls an AnkerMake M5 3D printer. " +
      "Use search_models to find 3D models on Printables.com, " +
      "download_model to fetch STL files, " +
      "slice_model to convert STL to GCode, " +
      "analyze_gcode to check print estimates, " +
      "and send_print to upload and start printing. " +
      "Use printer_status to monitor progress. " +
      "Always confirm with the user before starting a real print.",
  },
);

// Validate config at startup
const config = getConfig();
console.error(`[agent-printer] Starting MCP server v0.1.0`);
console.error(`[agent-printer] Workspace: ${config.workspaceDir}`);

// Register all tool groups
registerSearchTools(server);
registerDownloadTools(server);
registerSliceTools(server);
registerGcodeTools(server);
registerPrintTools(server);
registerPrinterTools(server);
registerCameraTools(server);
registerDesignTools(server);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[agent-printer] MCP server running on stdio");
