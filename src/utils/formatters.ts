/**
 * Utilities for formatting Arke search results for AI consumption
 */

import type { SearchResponse, SearchResult, EntityResponse } from "../types.js";

/**
 * Deep search for extracted text in nested object structures
 */
function findExtractedText(obj: unknown): string[] {
	const results: string[] = [];

	function search(value: unknown): void {
		if (value === null || value === undefined) return;

		if (typeof value === "string") return;

		if (typeof value === "object") {
			for (const [key, val] of Object.entries(value)) {
				// Check for extracted text fields (case-insensitive match)
				if (
					key.toLowerCase() === "extractedtext" ||
					key.toLowerCase() === "extracted_text"
				) {
					if (typeof val === "string" && val.trim().length > 0) {
						results.push(val.trim());
					}
				}
				// Recurse into nested objects/arrays
				search(val);
			}
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				search(item);
			}
		}
	}

	search(obj);
	return results;
}

/**
 * Format a single search result in concise mode (abbreviated, key info only)
 */
function formatSearchResultConcise(result: SearchResult, index: number): string {
	const sections: string[] = [];

	// Header with rank and score
	sections.push(
		`## Result ${index + 1} (Score: ${result.score.toFixed(3)})`,
	);

	// Basic info with website link
	sections.push(`- **Type**: ${result.namespace}`);
	sections.push(`- **PI**: ${result.pi}`);
	sections.push(`- **View on Arke**: https://arke.institute/${result.pi}`);

	// Title and metadata
	if (result.metadata?.title) {
		sections.push(`- **Title**: ${result.metadata.title}`);
	}

	if (result.metadata?.level) {
		sections.push(`- **Level**: ${result.metadata.level}`);
	}

	// NARA ID
	if (result.metadata?.nara_naId || result.pinecone_metadata.nara_naId) {
		const naId =
			result.metadata?.nara_naId || result.pinecone_metadata.nara_naId;
		sections.push(`- **NARA ID**: ${naId}`);
	}

	// Date range
	if (result.pinecone_metadata.date_start || result.pinecone_metadata.date_end) {
		const startYear = result.pinecone_metadata.date_start
			? String(result.pinecone_metadata.date_start).substring(0, 4)
			: "?";
		const endYear = result.pinecone_metadata.date_end
			? String(result.pinecone_metadata.date_end).substring(0, 4)
			: "?";
		sections.push(`- **Date Range**: ${startYear} - ${endYear}`);
	}

	// Record types
	if (result.metadata?.record_types && result.metadata.record_types.length > 0) {
		sections.push(
			`- **Record Types**: ${result.metadata.record_types.join(", ")}`,
		);
	}

	// Digital object specific info
	if (result.namespace === "digitalObject") {
		if (result.metadata?.filename) {
			sections.push(`- **Filename**: ${result.metadata.filename}`);
		}
		if (result.metadata?.file_size) {
			const sizeMB = (result.metadata.file_size / 1024 / 1024).toFixed(2);
			sections.push(`- **File Size**: ${sizeMB} MB`);
		}
	}

	// Digital object count for collections/series/fileUnits
	if (result.metadata?.digital_object_count) {
		sections.push(
			`- **Digital Objects**: ${result.metadata.digital_object_count}`,
		);
	}

	// Parent/child relationships
	if (result.manifest.parent_pi) {
		sections.push(`- **Parent PI**: ${result.manifest.parent_pi}`);
	}
	if (
		result.manifest.children_pi &&
		result.manifest.children_pi.length > 0
	) {
		sections.push(
			`- **Children**: ${result.manifest.children_pi.length} entities`,
		);
	}

	// Access restrictions
	if (result.metadata?.access_restriction) {
		const restriction = result.metadata.access_restriction;
		if (restriction.status) {
			sections.push(`- **Access**: ${restriction.status}`);
		}
	}

	// Physical location
	if (
		result.metadata?.physical_location?.referenceUnits &&
		result.metadata.physical_location.referenceUnits.length > 0
	) {
		const location = result.metadata.physical_location.referenceUnits[0];
		if (location.name) {
			sections.push(`- **Location**: ${location.name}`);
			if (location.city && location.state) {
				sections.push(`  ${location.city}, ${location.state}`);
			}
		}
	}

	// IPFS references
	sections.push(`- **Manifest CID**: ${result.manifest.manifest_cid}`);
	if (result.metadata_cid) {
		sections.push(`- **Metadata CID**: ${result.metadata_cid}`);
	}

	// Extracted text (deep search with character limit for concise mode)
	const extractedTexts = findExtractedText(result);
	if (extractedTexts.length > 0) {
		const combinedText = extractedTexts.join("\n\n---\n\n");
		const CHAR_LIMIT = 2000;
		const preview = combinedText.length > CHAR_LIMIT
			? `${combinedText.substring(0, CHAR_LIMIT)}...\n\n[Truncated - ${combinedText.length - CHAR_LIMIT} more characters available]`
			: combinedText;
		sections.push(`\n**Extracted Text Preview:**\n\`\`\`\n${preview}\n\`\`\``);
	}

	return sections.join("\n");
}

/**
 * Format a single search result in verbose mode (dump everything)
 */
function formatSearchResultVerbose(result: SearchResult, index: number): string {
	const sections: string[] = [];

	// Header
	sections.push(`## Result ${index + 1} (Score: ${result.score.toFixed(3)})`);
	sections.push("");
	sections.push(`**View on Arke**: https://arke.institute/${result.pi}`);
	sections.push("");

	// Dump complete objects as formatted JSON
	sections.push("### Complete Result Data");
	sections.push("");
	sections.push("```json");
	sections.push(JSON.stringify(result, null, 2));
	sections.push("```");

	return sections.join("\n");
}

/**
 * Format complete search response for AI consumption (concise mode)
 */
function formatSearchResponseConcise(response: SearchResponse): string {
	const output: string[] = [];

	// Summary
	output.push(`# Search Results for: "${response.query}"`);
	output.push("");
	output.push(`**Total Results**: ${response.total_results}`);
	output.push(
		`**Namespaces Searched**: ${response.namespaces.join(", ")}`,
	);
	if (response.took_ms) {
		output.push(`**Search Time**: ${response.took_ms}ms`);
	}
	output.push("");

	// Individual results
	if (response.results.length === 0) {
		output.push(
			"No results found. Try adjusting your query or searching different namespaces.",
		);
	} else {
		output.push("---");
		output.push("");
		for (let i = 0; i < response.results.length; i++) {
			output.push(formatSearchResultConcise(response.results[i], i));
			if (i < response.results.length - 1) {
				output.push("");
				output.push("---");
				output.push("");
			}
		}
	}

	// Footer with helpful info
	output.push("");
	output.push("---");
	output.push("");
	output.push("**Notes:**");
	output.push(
		"- PI (Persistent Identifier) can be used to fetch full entity data from Arke API",
	);
	output.push(
		"- CIDs (Content Identifiers) reference IPFS content for manifest and metadata",
	);
	output.push(
		"- Similarity scores range from 0-1, with higher scores indicating better matches",
	);

	return output.join("\n");
}

/**
 * Format complete search response in verbose mode (dump everything)
 */
function formatSearchResponseVerbose(response: SearchResponse): string {
	const output: string[] = [];

	// Summary
	output.push(`# Search Results for: "${response.query}"`);
	output.push("");
	output.push(`**Total Results**: ${response.total_results}`);
	output.push(
		`**Namespaces Searched**: ${response.namespaces.join(", ")}`,
	);
	if (response.took_ms) {
		output.push(`**Search Time**: ${response.took_ms}ms`);
	}
	output.push("");
	output.push("**Note**: Verbose mode - showing complete raw data for all results");
	output.push("");

	// Individual results
	if (response.results.length === 0) {
		output.push(
			"No results found. Try adjusting your query or searching different namespaces.",
		);
	} else {
		output.push("---");
		output.push("");
		for (let i = 0; i < response.results.length; i++) {
			output.push(formatSearchResultVerbose(response.results[i], i));
			if (i < response.results.length - 1) {
				output.push("");
				output.push("---");
				output.push("");
			}
		}
	}

	return output.join("\n");
}

/**
 * Main export: Format search results based on verbose flag
 */
export function formatSearchResultsForAI(
	response: SearchResponse,
	verbose = false,
): string {
	return verbose
		? formatSearchResponseVerbose(response)
		: formatSearchResponseConcise(response);
}

/**
 * Format entity responses for get_arke_entities tool
 */
export function formatEntitiesForAI(entities: EntityResponse[]): string {
	const output: string[] = [];

	output.push(`# Entity Details (${entities.length} ${entities.length === 1 ? "entity" : "entities"})`);
	output.push("");

	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i];

		output.push(`## Entity ${i + 1}: ${entity.pi}`);
		output.push("");
		output.push(`**View on Arke**: https://arke.institute/${entity.pi}`);
		output.push("");

		// Dump complete entity data
		output.push("### Complete Entity Data");
		output.push("");
		output.push("```json");
		output.push(JSON.stringify(entity, null, 2));
		output.push("```");

		if (i < entities.length - 1) {
			output.push("");
			output.push("---");
			output.push("");
		}
	}

	return output.join("\n");
}
