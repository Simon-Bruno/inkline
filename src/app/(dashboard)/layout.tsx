import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = data as Profile | null;

  const userInfo = {
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.email?.split("@")[0] ?? "User",
    avatarUrl: profile?.avatar_url ?? null,
  };

  return (
    <div className="noise-bg flex h-screen">
      <Sidebar user={userInfo} />
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
