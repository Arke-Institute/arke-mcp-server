import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArkeSearchClient } from "./clients/arke.js";
import { formatSearchResultsForAI } from "./utils/formatters.js";
import type { NamespaceInfo } from "./types.js";

/**
 * Arke Institute MCP Server
 * Provides semantic search capabilities across NARA archives and presidential libraries
 */
export class ArkeMCP extends McpAgent {
	server = new McpServer({
		name: "Arke Institute Search",
		version: "1.0.0",
	});

	private arkeClient = new ArkeSearchClient();
	private namespaceInfo: NamespaceInfo | null = null;

	async init() {
		try {
			// Fetch available namespaces at startup
			this.namespaceInfo = await this.arkeClient.getNamespaces();
			console.log(
				`Arke MCP: Loaded ${this.namespaceInfo.count} namespaces`,
			);

			// Build namespace description for tool documentation
			const namespaceDescriptions = this.namespaceInfo.namespaces
				.map((ns) => `${ns} (${this.namespaceInfo?.description[ns]})`)
				.join(", ");

			// Create Zod enum from available namespaces
			const namespaceEnum = z.enum(
				this.namespaceInfo.namespaces as [string, ...string[]],
			);

			// Define the search_arke tool with dynamic namespace validation
			this.server.tool(
				"search_arke",
				{
					query: z
						.string()
						.min(1)
						.describe(
							"Natural language search query for Arke Institute archives. Supports semantic search across NARA records, presidential libraries, historical documents, and digitized materials.",
						),
					topK: z
						.number()
						.int()
						.min(1)
						.max(100)
						.optional()
						.default(10)
						.describe(
							"Number of results to return (1-100). Default: 10. Higher values return more results but may include less relevant matches.",
						),
					namespaces: z
						.array(namespaceEnum)
						.optional()
						.describe(
							`Optional: Filter results by entity type(s). Available namespaces: ${namespaceDescriptions}. If omitted, searches all entity types. Use specific namespaces to narrow results (e.g., ["digitalObject"] for scanned documents with extracted text, ["fileUnit"] for archival file units).`,
						),
				},
				async ({ query, topK, namespaces }) => {
					try {
						console.log(
							`Arke MCP: Searching for "${query}" (topK: ${topK}, namespaces: ${namespaces?.join(", ") || "all"})`,
						);

						// Perform the search
						const response = await this.arkeClient.search({
							query,
							topK,
							namespaces,
						});

						console.log(
							`Arke MCP: Found ${response.total_results} results in ${response.took_ms}ms`,
						);

						// Format results for AI consumption
						const formatted = formatSearchResultsForAI(response);

						return {
							content: [{ type: "text", text: formatted }],
						};
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : String(error);
						console.error(`Arke MCP: Search error - ${errorMessage}`);

						return {
							content: [
								{
									type: "text",
									text: `Error performing search: ${errorMessage}\n\nPlease try:\n- Simplifying your query\n- Using different search terms\n- Checking your namespace filters\n- Reducing the topK value`,
								},
							],
							isError: true,
						};
					}
				},
			);

			console.log("Arke MCP: Initialized successfully");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(`Arke MCP: Initialization error - ${errorMessage}`);
			throw error;
		}
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return ArkeMCP.serveSSE("/sse", { binding: "ARKE_MCP_OBJECT" }).fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return ArkeMCP.serve("/mcp", { binding: "ARKE_MCP_OBJECT" }).fetch(request, env, ctx);
		}

		// Root endpoint - provide info about the MCP server
		if (url.pathname === "/") {
			return new Response(
				JSON.stringify({
					name: "Arke Institute MCP Server",
					version: "1.0.0",
					description:
						"Semantic search for NARA archives and presidential libraries",
					endpoints: {
						sse: "/sse - Server-Sent Events endpoint for MCP protocol",
						mcp: "/mcp - Standard MCP endpoint",
					},
					tools: ["search_arke"],
					repository: "https://github.com/arke-institute",
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response("Not found", { status: 404 });
	},
};
