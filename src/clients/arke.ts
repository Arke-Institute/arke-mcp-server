/**
 * Arke Search API client
 * Provides methods to interact with the Arke Institute search service
 */

import type {
	NamespaceInfo,
	SearchRequest,
	SearchResponse,
	EntityResponse,
} from "../types.js";

export class ArkeSearchClient {
	private baseUrl = "https://search.arke.institute";
	private apiUrl = "https://api.arke.institute";

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

	/**
	 * Fetch entity details by PI (Persistent Identifier)
	 */
	async getEntity(pi: string): Promise<EntityResponse> {
		try {
			const response = await fetch(`${this.apiUrl}/entities/${pi}`);

			if (!response.ok) {
				throw new Error(
					`Failed to fetch entity ${pi}: ${response.status} ${response.statusText}`,
				);
			}

			return await response.json();
		} catch (error) {
			throw new Error(
				`Error fetching entity ${pi}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Fetch multiple entities in parallel by their PIs
	 */
	async getEntities(pis: string[]): Promise<EntityResponse[]> {
		try {
			// Fetch all entities in parallel
			const promises = pis.map((pi) => this.getEntity(pi));
			return await Promise.all(promises);
		} catch (error) {
			throw new Error(
				`Error fetching entities: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
