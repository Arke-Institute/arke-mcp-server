/**
 * TypeScript type definitions for Arke Search API
 */

// Namespace API response
export interface NamespaceInfo {
	namespaces: string[];
	count: number;
	description: Record<string, string>;
}

// Search request parameters
export interface SearchRequest {
	query: string;
	topK?: number;
	namespaces?: string[];
}

// Pinecone metadata structure
export interface PineconeMetadata {
	pi: string;
	schema: string;
	nara_naId?: number;
	date_start?: number;
	date_end?: number;
	parent_ancestry?: string[];
	last_updated: string;
	[key: string]: unknown;
}

// Entity manifest structure
export interface EntityManifest {
	pi: string;
	ver: number;
	ts: string;
	manifest_cid: string;
	prev_cid?: string | null;
	components: Record<string, string>;
	children_pi?: string[];
	parent_pi?: string;
	note?: string;
}

// Entity metadata (varies by type)
export interface EntityMetadata {
	title?: string;
	level?: string;
	nara_naId?: number;
	schema?: string;
	record_types?: string[];
	digital_object_count?: number;
	extracted_text?: string;
	file_size?: number;
	filename?: string;
	access_restriction?: {
		status?: string;
		note?: string;
		specificAccessRestrictions?: Array<{
			restriction?: string;
			securityClassification?: string;
		}>;
	};
	physical_location?: {
		copyStatus?: string;
		referenceUnits?: Array<{
			name?: string;
			address1?: string;
			city?: string;
			state?: string;
			postalCode?: string;
			phone?: string;
			email?: string;
		}>;
	};
	[key: string]: unknown;
}

// Individual search result
export interface SearchResult {
	score: number;
	pi: string;
	namespace: string;
	pinecone_metadata: PineconeMetadata;
	manifest: EntityManifest;
	metadata: EntityMetadata | null;
	metadata_cid?: string;
}

// Complete search response
export interface SearchResponse {
	query: string;
	namespaces: string[];
	total_results: number;
	results: SearchResult[];
	took_ms?: number;
}

// Entity API response (from api.arke.institute/entities/{pi})
// Note: The API returns the manifest fields directly at the top level
export interface EntityResponse extends EntityManifest {
	// Additional fields for enriched data
	metadata?: EntityMetadata | null;
	metadata_cid?: string;
	// Component data fetched from IPFS
	component_data?: Record<string, unknown>;
}

// Batch entity fetch request
export interface GetEntitiesRequest {
	pis: string[];
}
