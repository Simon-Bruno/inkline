"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PenLine, Check } from "lucide-react";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ProfileData {
  full_name: string;
  email: string;
  company: string;
  title: string;
}

export default function SettingsPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    email: "",
    company: "",
    title: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const row = data as Profile | null;
      if (row) {
        setProfile({
          full_name: row.full_name || "",
          email: row.email || "",
          company: row.company || "",
          title: row.title || "",
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase
      .from("profiles") as ReturnType<typeof supabase.from>)
      .update({
        full_name: profile.full_name,
        company: profile.company || null,
        title: profile.title || null,
      } as unknown as Record<string, unknown>)
      .eq("id", user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="stagger-fade space-y-10">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile section */}
      <section className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="border-b border-border/50 px-6 py-5">
          <h2 className="text-base font-semibold">Profile</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your personal information used across Inkline
          </p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSave} className="max-w-md space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full name</label>
              <Input
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                required
                className="h-10 bg-background/50 transition-colors focus:bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                value={profile.email}
                disabled
                className="h-10 opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Company</label>
              <Input
                value={profile.company}
                onChange={(e) =>
                  setProfile({ ...profile, company: e.target.value })
                }
                placeholder="Your company name"
                className="h-10 bg-background/50 transition-colors focus:bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={profile.title}
                onChange={(e) =>
                  setProfile({ ...profile, title: e.target.value })
                }
                placeholder="Your job title"
                className="h-10 bg-background/50 transition-colors focus:bg-background"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : null}
                {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Signature section */}
      <section className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="border-b border-border/50 px-6 py-5">
          <h2 className="text-base font-semibold">Saved Signature</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your signature will be pre-filled when you sign documents
          </p>
        </div>
        <div className="p-6">
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/50">
            <div className="text-center">
              <PenLine className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No saved signature yet
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                Your signature will be saved when you first sign a document
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
