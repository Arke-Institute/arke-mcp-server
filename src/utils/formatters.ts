/**
 * Utilities for formatting Arke search results for AI consumption
 */

import type { SearchResponse, SearchResult } from "../types.js";

/**
 * Format a single search result with key information prioritized
 */
function formatSearchResult(result: SearchResult, index: number): string {
	const sections: string[] = [];

	// Header with rank and score
	sections.push(
		`## Result ${index + 1} (Score: ${result.score.toFixed(3)})`,
	);

	// Basic info
	sections.push(`- **Type**: ${result.namespace}`);
	sections.push(`- **PI**: ${result.pi}`);

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

	// Extracted text (truncated for digital objects)
	if (result.metadata?.extracted_text) {
		const text = result.metadata.extracted_text.trim();
		const preview = text.length > 500 ? `${text.substring(0, 500)}...` : text;
		sections.push(`\n**Extracted Text Preview:**\n\`\`\`\n${preview}\n\`\`\``);
	}

	return sections.join("\n");
}

/**
 * Format complete search response for AI consumption
 */
export function formatSearchResultsForAI(response: SearchResponse): string {
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
			output.push(formatSearchResult(response.results[i], i));
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
