"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import { getApiBaseUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Workspace settings: session, API endpoint, and integration notes.
 */
export default function SettingsPage() {
  const { data: session, status } = useSession();
  const apiUrl = getApiBaseUrl();

  return (
    <AppShell>
      <h1 className="text-2xl font-medium text-white">Settings</h1>
      <p className="text-sm text-white/60">Session, API connection, and where to configure secrets.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed-in user from NextAuth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {status === "loading" ? (
              <p className="text-white/60">Loading session…</p>
            ) : (
              <>
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/50">Email</div>
                  <div className="liquid-glass mt-1 rounded-xl px-4 py-3 font-mono text-xs text-white/60">
                    {session?.user?.email ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/50">Name</div>
                  <div className="liquid-glass mt-1 rounded-xl px-4 py-3 text-sm text-white/80">
                    {session?.user?.name ?? "—"}
                  </div>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/login">Switch account</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle>API and data</CardTitle>
            <CardDescription>Fairness engine endpoint (from `NEXT_PUBLIC_API_URL`).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="liquid-glass break-all rounded-xl px-4 py-3 font-mono text-xs text-white/60">{apiUrl}</div>
            <p className="text-white/60">
              Datasets and audits for this prototype live in the FastAPI in-memory store unless you wire Prisma +
              persistence.
            </p>
            <Button asChild variant="secondary" size="sm" data-testid="settings-health-check">
              <a href={`${apiUrl}/health`} target="_blank" rel="noreferrer">
                Open API health
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl p-6 lg:col-span-2">
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Configure in env files (not editable here).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/60">
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong className="text-white">Next.js</strong> — <code className="text-xs">frontend/.env.local</code>{" "}
                for <code className="text-xs">NEXTAUTH_SECRET</code>,{" "}
                <code className="text-xs">NEXT_PUBLIC_API_URL</code>, OAuth client IDs.
              </li>
              <li>
                <strong className="text-white">Database</strong> — <code className="text-xs">DATABASE_URL</code> in{" "}
                <code className="text-xs">.env.local</code> and <code className="text-xs">frontend/.env</code> (Prisma
                CLI). Run <code className="text-xs">npx prisma migrate dev</code> from <code className="text-xs">frontend/</code>.
              </li>
              <li>
                <strong className="text-white">FastAPI</strong> — optional <code className="text-xs">backend/.env</code>{" "}
                for <code className="text-xs">CORS_ORIGINS</code>, <code className="text-xs">DEMO_MODE</code>, upload path.
              </li>
            </ul>
            <p>
              Full variable list: see <code className="text-xs text-white">unbiasedai/.env.example</code> in the repo.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
