import type { OCRRequest, OCRResponse, OCRBatchResponse } from "../types.js";
import { config } from "../config.js";

/**
 * Client for the Arke OCR API
 * Extracts text from documents in IPFS-based Arke entities using DeepInfra's olmOCR model
 */
export class OCRClient {
  private baseUrl = config.ocr.apiUrl;

  /**
   * Extract text from one or more entities via OCR
   * Supports both single PI and batch processing
   * @param piOrPis - Single PI string or array of PIs
   * @param options - Optional parameters for OCR processing
   * @returns OCR response (single) or batch response (multiple)
   * @throws Error if the API request fails
   */
  async processOCR(
    piOrPis: string | string[],
    options?: { force_reprocess?: boolean }
  ): Promise<OCRResponse | OCRBatchResponse> {
    const isBatch = Array.isArray(piOrPis);

    const requestBody: OCRRequest = {
      force_reprocess: options?.force_reprocess ?? false,
      update_metadata: true, // Always update metadata
    };

    // Add pi or pis to request body
    if (isBatch) {
      requestBody.pis = piOrPis;
    } else {
      requestBody.pi = piOrPis;
    }

    // Use /ocr endpoint for batch, /ocr/{pi} for single
    const endpoint = isBatch
      ? `${this.baseUrl}/ocr`
      : `${this.baseUrl}/ocr/${piOrPis}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json() as { error?: string };
        errorMessage = errorData.error || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }

      throw new Error(
        `OCR API error (${response.status}): ${errorMessage}`
      );
    }

    return await response.json();
  }
}
