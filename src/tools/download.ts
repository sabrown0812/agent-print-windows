import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getModelFiles, getDownloadUrl } from "../lib/printables.js";
import { getConfig } from "../lib/config.js";

export function registerDownloadTools(server: McpServer) {
  server.tool(
    "download_model",
    "Download an STL file from Printables.com to the workspace. Use search_models first to find model IDs.",
    {
      model_id: z.string().describe("Printables model ID (from search_models results)"),
      file_index: z
        .number()
        .min(0)
        .default(0)
        .describe("Which file to download if the model has multiple STLs (0-based index)"),
    },
    async ({ model_id, file_index }) => {
      try {
        const files = await getModelFiles(model_id);
        if (files.length === 0) {
          return {
            content: [{ type: "text", text: `Model ${model_id} has no STL files.` }],
            isError: true,
          };
        }

        if (file_index >= files.length) {
          const fileList = files.map((f, i) => `  ${i}: ${f.name} (${formatBytes(f.sizeBytes)})`).join("\n");
          return {
            content: [
              {
                type: "text",
                text: `file_index ${file_index} out of range. Available files:\n${fileList}`,
              },
            ],
            isError: true,
          };
        }

        const file = files[file_index];

        // If multiple files available, mention them
        let fileListNote = "";
        if (files.length > 1) {
          fileListNote =
            `\n\nThis model has ${files.length} STL files:\n` +
            files.map((f, i) => `  ${i}: ${f.name} (${formatBytes(f.sizeBytes)})${i === file_index ? " [downloaded]" : ""}`).join("\n");
        }

        const downloadUrl = await getDownloadUrl(file.id);

        const res = await fetch(downloadUrl);
        if (!res.ok) {
          throw new Error(`Download failed: HTTP ${res.status}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());

        const config = getConfig();
        await mkdir(config.workspaceDir, { recursive: true });
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const outPath = path.join(config.workspaceDir, `printables_${model_id}_${safeName}`);
        await writeFile(outPath, buffer);

        return {
          content: [
            {
              type: "text",
              text:
                `Downloaded: ${file.name}\n` +
                `Size: ${formatBytes(buffer.length)}\n` +
                `Saved to: ${outPath}` +
                fileListNote +
                `\n\nUse slice_model with this path to slice it for printing.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Download failed: ${err}` }],
          isError: true,
        };
      }
    },
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
