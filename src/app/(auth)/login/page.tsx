"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createBrowserClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="noise-bg relative flex min-h-screen items-center justify-center px-4">
      {/* Warm ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-accent/3 blur-[100px]" />
      </div>

      <div className="stagger-fade relative z-10 w-full max-w-[380px]">
        {/* Brand */}
        <div className="mb-10 text-center">
          <h1 className="font-serif text-5xl tracking-tight">Inkline</h1>
          <p className="mt-3 text-sm tracking-wide text-muted-foreground">
            Sign documents with intelligence
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border/50 bg-card/80 p-8 shadow-xl shadow-black/5 backdrop-blur-sm dark:shadow-black/20">
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Check your email</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  We sent a magic link to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              <button
                className="mt-2 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold tracking-tight">
                  Welcome back
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your email to sign in
                </p>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-3">
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={loading}
                  className="h-11 bg-background/50 transition-colors focus:bg-background"
                />
                <Button
                  type="submit"
                  className="h-11 w-full gap-2 font-medium"
                  disabled={loading || !email}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {loading ? "Sending..." : "Continue with email"}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card/80 px-3 text-xs uppercase tracking-widest text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="h-11 w-full gap-3 bg-background/50 font-medium transition-colors hover:bg-background"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground/70">
          By continuing, you agree to our Terms of Service
          <br />
          and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
