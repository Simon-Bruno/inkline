"use client";

import { useCallback } from "react";
import { DraggableField, type FieldData } from "./draggable-field";
import type { FieldType } from "@/types";

interface FieldOverlayProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  fields: FieldData[];
  selectedFieldId: string | null;
  activeFieldType: FieldType | null;
  activeSignerId: string | null;
  signerIndexMap: Map<string, number>;
  onFieldSelect: (id: string) => void;
  onFieldMove: (id: string, x: number, y: number) => void;
  onFieldDelete: (id: string) => void;
  onFieldPlace: (field: Omit<FieldData, "id">) => void;
  onDeselect: () => void;
}

const DEFAULT_FIELD_SIZES: Record<FieldType, { width: number; height: number }> = {
  signature: { width: 20, height: 5 },
  initials: { width: 10, height: 5 },
  date: { width: 15, height: 4 },
  name: { width: 20, height: 4 },
  text: { width: 20, height: 4 },
  checkbox: { width: 3, height: 3 },
};

export function FieldOverlay({
  pageNumber,
  pageWidth,
  pageHeight,
  fields,
  selectedFieldId,
  activeFieldType,
  activeSignerId,
  signerIndexMap,
  onFieldSelect,
  onFieldMove,
  onFieldDelete,
  onFieldPlace,
  onDeselect,
}: FieldOverlayProps) {
  const pageFields = fields.filter((f) => f.page === pageNumber);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only place fields when clicking directly on the overlay background,
      // not when clicking on a field or its delete button
      if (e.target !== e.currentTarget) return;

      if (!activeFieldType || !activeSignerId) {
        onDeselect();
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      const size = DEFAULT_FIELD_SIZES[activeFieldType];
      const x = Math.max(0, Math.min(100 - size.width, xPct - size.width / 2));
      const y = Math.max(0, Math.min(100 - size.height, yPct - size.height / 2));

      onFieldPlace({
        type: activeFieldType,
        page: pageNumber,
        x,
        y,
        width: size.width,
        height: size.height,
        signerId: activeSignerId,
        isRequired: true,
        aiSuggested: false,
      });
    },
    [activeFieldType, activeSignerId, pageNumber, onFieldPlace, onDeselect]
  );

  return (
    <div
      className={`relative h-full w-full ${activeFieldType ? "cursor-crosshair" : ""}`}
      onClick={handleClick}
    >
      {pageFields.map((field) => (
        <DraggableField
          key={field.id}
          field={field}
          signerIndex={signerIndexMap.get(field.signerId) ?? 0}
          containerWidth={pageWidth}
          containerHeight={pageHeight}
          selected={selectedFieldId === field.id}
          onSelect={() => onFieldSelect(field.id)}
          onMove={(x, y) => onFieldMove(field.id, x, y)}
          onDelete={() => onFieldDelete(field.id)}
        />
      ))}
    </div>
  );
}
