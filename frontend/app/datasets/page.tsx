"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ApiError, listDatasets } from "@/lib/api";
import type { DatasetRecord } from "@/types/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Lists datasets from the FastAPI in-memory store (uploads via audit wizard).
 */
export default function DatasetsPage() {
  const [rows, setRows] = useState<DatasetRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await listDatasets();
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.body : "Could not load datasets — is the API running?");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-white">Datasets</h1>
          <p className="text-sm text-white/60">
            Files uploaded through the app are listed here (API store). Prisma/S3 can replace this later.
          </p>
        </div>
        <Button asChild data-testid="datasets-new">
          <Link href="/audit/new">Upload dataset</Link>
        </Button>
      </div>

      {error ? (
        <Card className="mt-6 rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base text-amber-300">Could not reach API</CardTitle>
            <CardDescription>Start the backend: uvicorn main:app --port 8000</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-white/60">{error}</CardContent>
        </Card>
      ) : null}

      <Card className="mt-6 rounded-3xl">
        <CardHeader>
          <CardTitle>Your datasets</CardTitle>
          <CardDescription>{loading ? "Loading…" : `${rows.length} dataset(s) in the current API session.`}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 && !loading ? (
            <p className="text-sm text-white/60">
              No datasets yet. Use <strong>Upload dataset</strong> or run a new audit — each upload registers here until
              the API restarts (in-memory store).
            </p>
          ) : (
            <table className="w-full text-left text-sm text-white/80">
              <thead className="text-xs uppercase text-white/40">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Id</th>
                  <th className="pb-2">Rows</th>
                  <th className="pb-2">Size</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-white/10">
                    <td className="py-2 font-medium text-white">{d.name}</td>
                    <td className="py-2 font-mono text-xs text-white/60">{d.id}</td>
                    <td className="py-2 text-white/60">{d.row_count ?? d.rowCount ?? "—"}</td>
                    <td className="py-2 text-white/60">
                      {typeof (d.file_size ?? d.fileSize) === "number"
                        ? `${Math.round(((d.file_size ?? d.fileSize) as number) / 1024)} KB`
                        : "—"}
                    </td>
                    <td className="py-2">
                      <span className="liquid-glass glass-pill text-xs text-white/60">{d.status ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
