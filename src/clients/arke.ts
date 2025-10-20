/**
 * Arke Search API client
 * Provides methods to interact with the Arke Institute search service
 */

import type {
	NamespaceInfo,
	SearchRequest,
	SearchResponse,
} from "../types.js";

export class ArkeSearchClient {
	private baseUrl = "https://search.arke.institute";

	/**
	 * Fetch available namespaces and their descriptions
	 */
	async getNamespaces(): Promise<NamespaceInfo> {
		try {
			const response = await fetch(`${this.baseUrl}/namespaces`);

			if (!response.ok) {
				throw new Error(
					`Failed to fetch namespaces: ${response.status} ${response.statusText}`,
				);
			}

			return await response.json();
		} catch (error) {
			throw new Error(
				`Error fetching namespaces: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Perform semantic search across Arke archives
	 */
	async search(request: SearchRequest): Promise<SearchResponse> {
		try {
			const response = await fetch(this.baseUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(request),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Search request failed: ${response.status} ${response.statusText} - ${errorText}`,
				);
			}

			return await response.json();
		} catch (error) {
			throw new Error(
				`Error performing search: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
