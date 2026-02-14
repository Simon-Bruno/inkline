"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Clock,
  Settings,
  LogOut,
  ChevronsUpDown,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";

interface SidebarProps {
  user: {
    email: string;
    fullName: string;
    avatarUrl: string | null;
  };
}

const navItems = [
  { href: "/dashboard", label: "Documents", icon: FileText },
  { href: "/dashboard/awaiting", label: "Awaiting Me", icon: Clock },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();
  const { theme, setTheme } = useTheme();

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="flex w-[240px] flex-col border-r border-border/50 bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="font-serif text-xl tracking-tight">Inkline</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  isActive
                    ? "text-accent"
                    : "text-muted-foreground/70 group-hover:text-foreground"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border/50 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary"
            >
              <Avatar className="h-7 w-7">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                <AvatarFallback className="bg-accent/10 text-[10px] font-semibold text-accent">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="truncate text-[13px] font-medium">
                  {user.fullName}
                </p>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
