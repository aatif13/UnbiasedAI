"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ApiError, getApiBaseUrl, getAuditReport } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Printable / shareable HTML report wrapper with export affordances.
 */
export default function ReportPage({ params }: { params: { id: string } }) {
  const [html, setHtml] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getAuditReport(params.id);
        if (!cancelled) {
          setHtml(res.html);
          setToken(res.shared_token);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.body : "Unable to load report");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const shareUrl = token ? `${getApiBaseUrl()}/reports/share/${token}` : "";

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Report</p>
          <h1 className="text-2xl font-medium text-white">Executive fairness report</h1>
          <p className="text-xs text-white/50">{params.id}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              if (!shareUrl) return;
              void navigator.clipboard.writeText(shareUrl);
            }}
            data-testid="copy-share-link"
          >
            Copy Share Link
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              if (!html) return;
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `audit-${params.id}.html`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            data-testid="export-pdf-placeholder"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}
      {token ? (
        <Card className="mt-6 rounded-3xl p-8">
          <CardHeader>
            <CardTitle>Shareable link</CardTitle>
            <CardDescription>Public HTML endpoint on the FastAPI service.</CardDescription>
          </CardHeader>
          <CardContent className="break-all">
            <span className="liquid-glass glass-pill font-mono text-xs text-white/60">{shareUrl}</span>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6 rounded-3xl p-8">
        <CardHeader>
          <CardTitle>Live HTML</CardTitle>
          <CardDescription>Embedded report preview.</CardDescription>
        </CardHeader>
        <CardContent>
          {html ? (
            <iframe title="report" className="h-[720px] w-full rounded-2xl bg-white" srcDoc={html} />
          ) : (
            <div className="text-sm text-white/60">Preparing report…</div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
