import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchPrintables } from "../lib/printables.js";

export function registerSearchTools(server: McpServer) {
  server.tool(
    "search_models",
    "Search for 3D printable models on Printables.com. Returns model IDs, names, authors, and URLs. Use download_model to fetch the STL files.",
    {
      query: z.string().describe("Search query (e.g. 'desk organizer', 'phone stand')"),
      limit: z.number().min(1).max(50).default(10).describe("Max results to return"),
    },
    async ({ query, limit }) => {
      try {
        const results = await searchPrintables(query, limit);
        if (results.length === 0) {
          return { content: [{ type: "text", text: `No models found for "${query}".` }] };
        }
        const text = results
          .map(
            (r, i) =>
              `${i + 1}. **${r.name}** by ${r.author}\n` +
              `   ID: ${r.id} | Downloads: ${r.downloadCount}\n` +
              `   ${r.url}`,
          )
          .join("\n\n");
        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} models for "${query}":\n\n${text}\n\nUse download_model with the ID to fetch STL files.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Search failed: ${err}` }],
          isError: true,
        };
      }
    },
  );
}
