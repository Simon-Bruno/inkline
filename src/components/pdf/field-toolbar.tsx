"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  PenTool,
  Hash,
  Calendar,
  User,
  Type,
  CheckSquare,
} from "lucide-react";
import type { FieldType } from "@/types";

const FIELD_OPTIONS: { type: FieldType; label: string; icon: React.ElementType; shortcut: string }[] = [
  { type: "signature", label: "Signature", icon: PenTool, shortcut: "S" },
  { type: "date", label: "Date", icon: Calendar, shortcut: "D" },
  { type: "name", label: "Name", icon: User, shortcut: "N" },
  { type: "initials", label: "Initials", icon: Hash, shortcut: "I" },
  { type: "text", label: "Text", icon: Type, shortcut: "T" },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, shortcut: "C" },
];

interface FieldToolbarProps {
  activeType: FieldType | null;
  onSelect: (type: FieldType | null) => void;
  disabled?: boolean;
}

export function FieldToolbar({ activeType, onSelect, disabled }: FieldToolbarProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (disabled) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const option = FIELD_OPTIONS.find(
        (o) => o.shortcut.toLowerCase() === e.key.toLowerCase()
      );
      if (option) {
        e.preventDefault();
        onSelect(activeType === option.type ? null : option.type);
      }
      if (e.key === "Escape") {
        onSelect(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeType, onSelect, disabled]);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Field Types
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {FIELD_OPTIONS.map(({ type, label, icon: Icon, shortcut }) => (
          <Button
            key={type}
            variant={activeType === type ? "default" : "outline"}
            size="sm"
            className="h-auto justify-start gap-2 px-2.5 py-2 text-xs"
            onClick={() => onSelect(activeType === type ? null : type)}
            disabled={disabled}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
            <kbd className="ml-auto rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              {shortcut}
            </kbd>
          </Button>
        ))}
      </div>
      {activeType && (
        <p className="text-xs text-muted-foreground">
          Click on the PDF to place. Press <kbd className="rounded bg-muted px-1">Esc</kbd> to cancel.
        </p>
      )}
    </div>
  );
}
