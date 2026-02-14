"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SIGNER_COLORS } from "./draggable-field";
import { Plus, Trash2, Users } from "lucide-react";
import type { SigningOrder } from "@/types";

export interface SignerData {
  id: string;
  name: string;
  email: string;
  orderIndex: number;
}

interface SignerPanelProps {
  signers: SignerData[];
  activeSignerId: string | null;
  signingOrder: SigningOrder;
  onAddSigner: (name: string, email: string) => void;
  onRemoveSigner: (id: string) => void;
  onSelectSigner: (id: string) => void;
  onSigningOrderChange: (order: SigningOrder) => void;
}

export function SignerPanel({
  signers,
  activeSignerId,
  signingOrder,
  onAddSigner,
  onRemoveSigner,
  onSelectSigner,
  onSigningOrderChange,
}: SignerPanelProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleAdd = () => {
    if (!name.trim() || !email.trim()) return;
    onAddSigner(name.trim(), email.trim());
    setName("");
    setEmail("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Signers
        </h3>
        <div className="flex rounded-md border text-xs">
          <button
            className={`px-2 py-1 transition-colors ${
              signingOrder === "parallel"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onSigningOrderChange("parallel")}
          >
            Parallel
          </button>
          <button
            className={`border-l px-2 py-1 transition-colors ${
              signingOrder === "sequential"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onSigningOrderChange("sequential")}
          >
            Sequential
          </button>
        </div>
      </div>

      {/* Signer list */}
      <div className="space-y-1.5">
        {signers.map((signer, idx) => {
          const colors = SIGNER_COLORS[idx % SIGNER_COLORS.length];
          const isActive = activeSignerId === signer.id;
          return (
            <div
              key={signer.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                isActive
                  ? `${colors.bg} ${colors.border}`
                  : "border-transparent hover:bg-muted/50"
              }`}
              onClick={() => onSelectSigner(signer.id)}
            >
              <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{signer.name}</p>
                <p className="truncate text-xs text-muted-foreground">{signer.email}</p>
              </div>
              {signingOrder === "sequential" && (
                <span className="shrink-0 text-xs text-muted-foreground">#{idx + 1}</span>
              )}
              <button
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSigner(signer.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {signers.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-6 text-center">
          <Users className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Add signers to place fields</p>
        </div>
      )}

      {/* Add signer form */}
      <div className="space-y-2">
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={handleAdd}
          disabled={!name.trim() || !email.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Signer
        </Button>
      </div>
    </div>
  );
}
