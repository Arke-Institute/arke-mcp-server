/**
 * Configuration for Arke MCP Server
 * Centralized API endpoints and URLs
 */

export const config = {
  /**
   * Arke Search API
   * Semantic search across NARA archives and presidential libraries
   */
  arke: {
    searchUrl: "https://search.arke.institute",
    apiUrl: "https://api.arke.institute",
    ipfsUrl: "https://ipfs.arke.institute",
  },

  /**
   * OCR API
   * Text extraction from documents using DeepInfra's olmOCR model
   */
  ocr: {
    apiUrl: "https://ocr-api.arke.institute",
  },
} as const;
