"use client";

import { useRef, useCallback, useState } from "react";
import {
  Type,
  PenTool,
  Calendar,
  User,
  CheckSquare,
  Hash,
  X,
} from "lucide-react";
import type { FieldType } from "@/types";

const FIELD_ICONS: Record<FieldType, React.ElementType> = {
  signature: PenTool,
  initials: Hash,
  date: Calendar,
  name: User,
  text: Type,
  checkbox: CheckSquare,
};

const FIELD_LABELS: Record<FieldType, string> = {
  signature: "Signature",
  initials: "Initials",
  date: "Date",
  name: "Name",
  text: "Text",
  checkbox: "Check",
};

export interface FieldData {
  id: string;
  type: FieldType;
  page: number;
  x: number; // percentage 0-100
  y: number;
  width: number;
  height: number;
  signerId: string;
  isRequired: boolean;
  aiSuggested: boolean;
}

export const SIGNER_COLORS = [
  { bg: "bg-blue-500/15", border: "border-blue-500/60", text: "text-blue-700", dot: "bg-blue-500" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/60", text: "text-emerald-700", dot: "bg-emerald-500" },
  { bg: "bg-orange-500/15", border: "border-orange-500/60", text: "text-orange-700", dot: "bg-orange-500" },
  { bg: "bg-purple-500/15", border: "border-purple-500/60", text: "text-purple-700", dot: "bg-purple-500" },
  { bg: "bg-pink-500/15", border: "border-pink-500/60", text: "text-pink-700", dot: "bg-pink-500" },
];

interface DraggableFieldProps {
  field: FieldData;
  signerIndex: number;
  containerWidth: number;
  containerHeight: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onDelete: () => void;
}

export function DraggableField({
  field,
  signerIndex,
  containerWidth,
  containerHeight,
  selected,
  onSelect,
  onMove,
  onDelete,
}: DraggableFieldProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ startX: number; startY: number; fieldX: number; fieldY: number } | null>(null);

  const colors = SIGNER_COLORS[signerIndex % SIGNER_COLORS.length];
  const Icon = FIELD_ICONS[field.type];
  const label = FIELD_LABELS[field.type];

  const pxLeft = (field.x / 100) * containerWidth;
  const pxTop = (field.y / 100) * containerHeight;
  const pxWidth = (field.width / 100) * containerWidth;
  const pxHeight = (field.height / 100) * containerHeight;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      setDragging(true);
      dragStart.current = {
        startX: e.clientX,
        startY: e.clientY,
        fieldX: field.x,
        fieldY: field.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [field.x, field.y, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragStart.current) return;
      const dx = e.clientX - dragStart.current.startX;
      const dy = e.clientY - dragStart.current.startY;
      const newX = dragStart.current.fieldX + (dx / containerWidth) * 100;
      const newY = dragStart.current.fieldY + (dy / containerHeight) * 100;
      onMove(
        Math.max(0, Math.min(100 - field.width, newX)),
        Math.max(0, Math.min(100 - field.height, newY))
      );
    },
    [dragging, containerWidth, containerHeight, field.width, field.height, onMove]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  return (
    <div
      ref={ref}
      className={`absolute flex cursor-grab select-none items-center gap-1 rounded border-2 transition-shadow ${colors.bg} ${colors.border} ${
        selected ? "ring-2 ring-primary shadow-lg" : ""
      } ${dragging ? "cursor-grabbing opacity-90 shadow-xl" : "hover:shadow-md"}`}
      style={{
        left: pxLeft,
        top: pxTop,
        width: pxWidth,
        height: pxHeight,
        zIndex: selected ? 20 : 10,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className={`flex h-full w-full items-center justify-center gap-1 px-1 ${colors.text}`}>
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate text-[10px] font-medium leading-tight">
          {label}
        </span>
      </div>
      {field.aiSuggested && (
        <span className="absolute -top-1.5 left-1 rounded bg-violet-600 px-1 py-px text-[8px] font-medium text-white">
          AI
        </span>
      )}
      {selected && (
        <button
          className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
