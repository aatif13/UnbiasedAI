"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, Shield } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import VideoBackground from "@/components/layout/VideoBackground";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none";

function safeCallback(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

/**
 * Email/password registration backed by Prisma (`User.passwordHash`).
 */
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthCallbackUrl = safeCallback(searchParams.get("callbackUrl"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      router.push("/login?registered=1");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <VideoBackground />
      <div className="content-layer mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
        <div className="liquid-glass-strong w-full rounded-3xl p-8" data-testid="register-card">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="liquid-glass flex h-12 w-12 items-center justify-center rounded-full">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-medium text-white">UnbiasedAI</h1>
            <p className="text-sm text-white/60">Create your account</p>
          </div>
          <p className="mb-4 text-center text-sm text-white/60">
            Continue with Google when configured, or register with email and password (bcrypt hash in Postgres).
          </p>
          <div className="space-y-4">
            <GoogleSignInButton callbackUrl={oauthCallbackUrl} data-testid="register-google" withDividerBelow />
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="liquid-glass rounded-xl">
                <label htmlFor="reg-name" className="sr-only">
                  Name (optional)
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Name"
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="register-name"
                />
              </div>
              <div className="liquid-glass rounded-xl">
                <label htmlFor="reg-email" className="sr-only">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="register-email"
                />
              </div>
              <div className="liquid-glass flex items-center rounded-xl">
                <label htmlFor="reg-password" className="sr-only">
                  Password
                </label>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="register-password"
                />
                <button type="button" className="mr-3 text-white/40" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="liquid-glass flex items-center rounded-xl">
                <label htmlFor="reg-confirm" className="sr-only">
                  Confirm password
                </label>
                <input
                  id="reg-confirm"
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  className={inputClass}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  data-testid="register-confirm"
                />
                <button type="button" className="mr-3 text-white/40" onClick={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error ? <div className="text-sm text-red-300">{error}</div> : null}
              <Button className="w-full" type="submit" disabled={loading} data-testid="register-submit">
                {loading ? "Creating account…" : "Create account"}
              </Button>
              <p className="text-center text-xs text-white/60">
                Already have access?{" "}
                <Link className="text-white/80 underline" href="/login">
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">Loading…</div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
