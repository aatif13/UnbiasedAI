"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff, Shield } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
 * Email / Google sign-in form (uses `callbackUrl` query param when present).
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get("callbackUrl"));
  const registered = searchParams.get("registered") === "1";
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  /** Brief `readOnly` blocks most browser autofill until the user focuses the field. */
  const [autofillUnlock, setAutofillUnlock] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setAutofillUnlock(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen">
      <VideoBackground />
      <div className="content-layer mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
        <div className="liquid-glass-strong w-full rounded-3xl p-8" data-testid="login-card">
      {status === "authenticated" && session?.user ? (
        <div className="liquid-glass mb-4 rounded-2xl p-4 text-sm text-white/80" data-testid="login-existing-session">
            <p className="text-base font-medium text-white">Already signed in</p>
            <p className="mt-1 text-white/60">
              You still landed here because the home URL always opens the sign-in screen first.
            </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild type="button">
              <Link href={callbackUrl}>Continue to app</Link>
            </Button>
            <Button type="button" variant="secondary" onClick={() => void signOut({ callbackUrl: "/login" })}>
              Sign out
            </Button>
          </div>
        </div>
      ) : null}

          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="liquid-glass flex h-12 w-12 items-center justify-center rounded-full">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-medium text-white">UnbiasedAI</h1>
            <p className="text-sm text-white/60">Sign in to your account</p>
          </div>
          <div className="space-y-4">
          {registered ? (
            <p className="liquid-glass-success rounded-xl px-3 py-2 text-sm text-emerald-300">
              Account created — you can sign in below.
            </p>
          ) : null}
          <form className="space-y-4" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1.5 text-sm">
              <label htmlFor="email" className="text-xs text-white/50">
                Email
              </label>
              <div className="liquid-glass rounded-xl">
                <input
                  id="email"
                  name="signin-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  readOnly={!autofillUnlock}
                  onFocus={() => setAutofillUnlock(true)}
                  className={inputClass}
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email"
                />
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <label htmlFor="password" className="text-xs text-white/50">
                Password
              </label>
              <div className="liquid-glass flex items-center rounded-xl">
                <input
                  id="password"
                  name="signin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  readOnly={!autofillUnlock}
                  onFocus={() => setAutofillUnlock(true)}
                  className={inputClass}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password"
                />
                <button
                  type="button"
                  className="mr-3 text-white/40"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </form>
          {error ? <div className="text-sm text-red-300">{error}</div> : null}
          <Button
            className="w-full"
            type="button"
            data-testid="login-submit"
            onClick={async () => {
              const res = await signIn("credentials", {
                email,
                password,
                callbackUrl,
                redirect: false,
              });
              if (res?.error) {
                setError("Invalid email or password");
              } else {
                window.location.href = callbackUrl;
              }
            }}
          >
            Continue with email
          </Button>
          <p className="text-center text-xs text-white/40">or continue with</p>
          <GoogleSignInButton callbackUrl={callbackUrl} data-testid="login-google" />
          <p className="text-center text-xs text-white/60">
            No account?{" "}
            <Link className="text-white/80 underline" href="/register">
              Register
            </Link>
            {" · "}
            <Link className="text-white/80 underline" href="/home">
              Product overview
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
