"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { AISuggestedField, AIContractSummary } from "./types";

interface UseAIProcessingOptions {
  documentId: string;
  /** Set to true to trigger processing on mount */
  autoProcess?: boolean;
}

interface UseAIProcessingResult {
  fields: AISuggestedField[] | null;
  summary: AIContractSummary | null;
  isProcessing: boolean;
  error: string | null;
  triggerProcessing: () => Promise<void>;
}

export function useAIProcessing({
  documentId,
  autoProcess = false,
}: UseAIProcessingOptions): UseAIProcessingResult {
  const [fields, setFields] = useState<AISuggestedField[] | null>(null);
  const [summary, setSummary] = useState<AIContractSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerProcessing = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process document");
      }

      const data = await response.json();
      setFields(data.fields);
      setSummary(data.summary);
      if (data.debug) {
        console.log("[Inkline AI] Field detection debug:", data.debug);
        if (data.debug.classificationError) {
          console.error("[Inkline AI] Classification failed:", data.debug.classificationError);
        } else {
          console.log("[Inkline AI] Labels sent:", data.debug.inputs?.slice(0, 10));
          console.log("[Inkline AI] Types returned:", data.debug.types);
          console.log("[Inkline AI] Raw Gemini response:", data.debug.rawGeminiResponse?.slice(0, 500));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  }, [documentId]);

  // Subscribe to Realtime updates for the document
  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`document-ai-${documentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "documents",
          filter: `id=eq.${documentId}`,
        },
        (payload) => {
          const updated = payload.new as {
            ai_fields?: unknown;
            ai_summary?: string | null;
          };

          if (updated.ai_fields) {
            setFields(updated.ai_fields as AISuggestedField[]);
          }

          if (updated.ai_summary) {
            try {
              setSummary(JSON.parse(updated.ai_summary));
            } catch {
              setSummary({ bullets: [updated.ai_summary] });
            }
          }

          if (updated.ai_fields || updated.ai_summary) {
            setIsProcessing(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  // Auto-process on mount if requested
  useEffect(() => {
    if (autoProcess) {
      triggerProcessing();
    }
  }, [autoProcess, triggerProcessing]);

  return { fields, summary, isProcessing, error, triggerProcessing };
}
