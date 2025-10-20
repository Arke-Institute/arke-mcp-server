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
	private ipfsUrl = "https://ipfs.arke.institute";

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
	 * Fetch content from IPFS by CID
	 */
	private async fetchFromIPFS(cid: string): Promise<unknown> {
		try {
			const response = await fetch(`${this.ipfsUrl}/ipfs/${cid}`);

			if (!response.ok) {
				throw new Error(
					`Failed to fetch from IPFS (${cid}): ${response.status} ${response.statusText}`,
				);
			}

			return await response.json();
		} catch (error) {
			throw new Error(
				`Error fetching from IPFS (${cid}): ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Fetch entity details by PI (Persistent Identifier)
	 * Automatically resolves and fetches metadata from IPFS
	 */
	async getEntity(pi: string): Promise<EntityResponse> {
		try {
			// Fetch the entity manifest
			const response = await fetch(`${this.apiUrl}/entities/${pi}`);

			if (!response.ok) {
				throw new Error(
					`Failed to fetch entity ${pi}: ${response.status} ${response.statusText}`,
				);
			}

			const entity = await response.json() as EntityResponse;

			// Fetch ALL component data from IPFS (like the main website does)
			// Note: entity.components is directly on the entity, not entity.manifest.components
			if (entity.components && Object.keys(entity.components).length > 0) {
				const componentData: Record<string, unknown> = {};

				// Fetch all components in parallel
				const componentPromises = Object.entries(entity.components).map(
					async ([name, cid]) => {
						try {
							const content = await this.fetchFromIPFS(cid);
							componentData[name] = content;

							// If this is the catalog_record, also set it as metadata for compatibility
							if (name === "catalog_record" && !entity.metadata) {
								entity.metadata = content as EntityResponse["metadata"];
								entity.metadata_cid = cid;
							}
						} catch (error) {
							console.warn(
								`Failed to fetch component ${name} for ${pi} from IPFS (${cid}): ${error instanceof Error ? error.message : String(error)}`,
							);
							componentData[name] = {
								error: `Failed to fetch: ${error instanceof Error ? error.message : String(error)}`,
							};
						}
					},
				);

				await Promise.all(componentPromises);
				entity.component_data = componentData;
			}

			return entity;
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
