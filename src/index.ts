import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArkeSearchClient } from "./clients/arke.js";
import { OCRClient } from "./clients/ocr.js";
import { formatSearchResultsForAI, formatEntitiesForAI, formatOCRResultForAI, formatOCRBatchResultForAI } from "./utils/formatters.js";
import type { NamespaceInfo, OCRResponse, OCRBatchResponse } from "./types.js";

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
	private ocrClient = new OCRClient();
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
						.max(20)
						.optional()
						.default(10)
						.describe(
							"Number of results to return (1-20 for concise mode, 1-5 for verbose mode). Default: 10. Higher values return more results but may include less relevant matches.",
						),
					namespaces: z
						.array(namespaceEnum)
						.optional()
						.describe(
							`Optional: Filter results by entity type(s). Available namespaces: ${namespaceDescriptions}. If omitted, searches all entity types. Use specific namespaces to narrow results (e.g., ["digitalObject"] for scanned documents with extracted text, ["fileUnit"] for archival file units).`,
						),
					verbose: z
						.boolean()
						.optional()
						.default(false)
						.describe(
							"Verbose mode: Returns complete raw data for all results (max topK=5). Concise mode (default): Returns formatted, abbreviated results (max topK=20).",
						),
				},
				async ({ query, topK, namespaces, verbose }) => {
					try {
						// Enforce topK limits based on verbose mode
						const maxTopK = verbose ? 5 : 20;
						const adjustedTopK = Math.min(topK, maxTopK);

						if (topK > maxTopK) {
							console.log(
								`Arke MCP: topK ${topK} exceeds max ${maxTopK} for ${verbose ? "verbose" : "concise"} mode, using ${adjustedTopK}`,
							);
						}

						console.log(
							`Arke MCP: Searching for "${query}" (topK: ${adjustedTopK}, namespaces: ${namespaces?.join(", ") || "all"}, verbose: ${verbose})`,
						);

						// Perform the search
						const response = await this.arkeClient.search({
							query,
							topK: adjustedTopK,
							namespaces,
						});

						console.log(
							`Arke MCP: Found ${response.total_results} results in ${response.took_ms}ms`,
						);

						// Format results for AI consumption
						const formatted = formatSearchResultsForAI(response, verbose);

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

			// Define the get_arke_entities tool for fetching full entity details
			this.server.tool(
				"get_arke_entities",
				{
					pis: z
						.array(z.string())
						.min(1)
						.max(10)
						.describe(
							"Array of Persistent Identifiers (PIs) to fetch (1-10 PIs). Each PI should be a valid Arke entity identifier (e.g., '01K7ZG1BTFDPMRJWEQB4JBYR42').",
						),
				},
				async ({ pis }) => {
					try {
						console.log(
							`Arke MCP: Fetching ${pis.length} ${pis.length === 1 ? "entity" : "entities"}: ${pis.join(", ")}`,
						);

						// Fetch all entities in parallel
						const entities = await this.arkeClient.getEntities(pis);

						console.log(
							`Arke MCP: Successfully fetched ${entities.length} ${entities.length === 1 ? "entity" : "entities"}`,
						);

						// Format entities for AI consumption
						const formatted = formatEntitiesForAI(entities);

						return {
							content: [{ type: "text", text: formatted }],
						};
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : String(error);
						console.error(`Arke MCP: Entity fetch error - ${errorMessage}`);

						return {
							content: [
								{
									type: "text",
									text: `Error fetching entities: ${errorMessage}\n\nPlease verify:\n- All PIs are valid Arke entity identifiers\n- The entities exist in the Arke system\n- You provided 1-10 PIs`,
								},
							],
							isError: true,
						};
					}
				},
			);

			// Define the extract_text_ocr tool for OCR text extraction (single or batch)
			this.server.tool(
				"extract_text_ocr",
				{
					pi: z
						.string()
						.min(1)
						.optional()
						.describe(
							"Single Persistent Identifier (PI) to extract text from. Use this OR 'pis' parameter (not both). The entity must contain JPEG or PNG images.",
						),
					pis: z
						.array(z.string().min(1))
						.min(1)
						.max(10)
						.optional()
						.describe(
							"Array of Persistent Identifiers (PIs) for batch processing (1-10 PIs). Use this OR 'pi' parameter (not both). All entities are processed in parallel.",
						),
					force_reprocess: z
						.boolean()
						.optional()
						.default(false)
						.describe(
							"Force reprocessing even if extracted text already exists. Use this when existing OCR quality is poor or was generated by a different OCR model. Default: false (uses cached results if available).",
						),
				},
				async ({ pi, pis, force_reprocess }) => {
					try {
						// Validate: exactly one of pi or pis must be provided
						if (!pi && !pis) {
							return {
								content: [
									{
										type: "text",
										text: "Error: You must provide either 'pi' (single entity) or 'pis' (batch of entities), but not both.",
									},
								],
								isError: true,
							};
						}

						if (pi && pis) {
							return {
								content: [
									{
										type: "text",
										text: "Error: You cannot provide both 'pi' and 'pis'. Use 'pi' for single entity or 'pis' for batch processing.",
									},
								],
								isError: true,
							};
						}

						const isBatch = !!pis;
						const piOrPis = isBatch ? pis : (pi as string);

						console.log(
							isBatch
								? `Arke MCP: Batch OCR for ${pis.length} entities (force_reprocess: ${force_reprocess})`
								: `Arke MCP: Extracting text from entity ${pi} (force_reprocess: ${force_reprocess})`,
						);

						const startTime = Date.now();

						// Call OCR API
						const response = await this.ocrClient.processOCR(piOrPis, {
							force_reprocess,
						});

						const totalTime = Date.now() - startTime;

						if (isBatch) {
							// Batch response
							const batchResponse = response as OCRBatchResponse;
							console.log(
								`Arke MCP: Batch OCR completed - ${batchResponse.successful}/${batchResponse.total_pis} successful in ${totalTime}ms`,
							);

							const formatted = formatOCRBatchResultForAI(batchResponse);
							return {
								content: [{ type: "text", text: formatted }],
							};
						} else {
							// Single response
							const singleResponse = response as OCRResponse;

							// Log based on status
							if (singleResponse.status === "error") {
								console.log(
									`Arke MCP: OCR error for ${pi} - ${singleResponse.error || "UNKNOWN"}: ${singleResponse.message || "No message"}`,
								);
							} else {
								const textLength = singleResponse.extracted_text?.length || 0;
								console.log(
									`Arke MCP: OCR ${singleResponse.cached ? "cached" : "processed"} for ${pi} - ${textLength} characters extracted in ${totalTime}ms`,
								);
							}

							const formatted = formatOCRResultForAI(singleResponse);
							return {
								content: [{ type: "text", text: formatted }],
							};
						}
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : String(error);
						const identifier = pi || (pis ? pis.join(", ") : "unknown");
						console.error(`Arke MCP: OCR error for ${identifier} - ${errorMessage}`);

						return {
							content: [
								{
									type: "text",
									text: `Error extracting text: ${errorMessage}\n\nPossible issues:\n- Entity does not exist\n- Entity has no JPEG/PNG images (PDF not supported by olmOCR)\n- Invalid PI format\n- OCR API service error\n\nTry:\n- Verifying the PI(s) are correct using get_arke_entities\n- Checking that the entities contain JPEG or PNG image files\n- Retrying the request`,
								},
							],
							isError: true,
						};
					}
				},
			);

			console.log("Arke MCP: Initialized successfully with 3 tools: search_arke, get_arke_entities, extract_text_ocr");
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
					tools: ["search_arke", "get_arke_entities", "extract_text_ocr"],
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
