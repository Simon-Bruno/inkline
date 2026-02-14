import type { FieldType } from "@/types";

export interface AISuggestedField {
  type: FieldType;
  page: number;
  /** Percentage-based x coordinate (0-100) */
  x: number;
  /** Percentage-based y coordinate (0-100) */
  y: number;
  /** Percentage-based width (0-100) */
  width: number;
  /** Percentage-based height (0-100) */
  height: number;
  label: string;
  /** The party/role this field belongs to (e.g., "CLIENT", "CONTRACTOR") */
  role?: string;
}

export interface AIContractSummary {
  bullets: string[];
}

export interface AIProcessingResult {
  fields: AISuggestedField[];
  summary: AIContractSummary;
}

export interface DocumentTextBlock {
  text: string;
  page: number;
  /** Normalized bounding box (0-1) from Document AI */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DocumentAIResult {
  fullText: string;
  blocks: DocumentTextBlock[];
  pageCount: number;
}
