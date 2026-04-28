"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { ApiError, listAudits } from "@/lib/api";
import type { AuditRecord } from "@/types/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Executive dashboard summarizing audits, datasets, and risk posture.
 */
export default function DashboardPage() {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await listAudits();
        if (!cancelled) setAudits(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.body : "Unable to reach API");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = audits.filter((a) => a.status === "COMPLETED");
  const atRisk = completed.filter((a) => ["HIGH", "CRITICAL"].includes(String(a.risk_level))).length;
  const avgScore =
    completed.length === 0
      ? 0
      : completed.reduce((sum, a) => sum + (a.overall_score ?? 0), 0) / completed.length;

  const riskData = [
    { name: "Low", value: completed.filter((a) => a.risk_level === "LOW").length },
    { name: "Medium", value: completed.filter((a) => a.risk_level === "MEDIUM").length },
    { name: "High", value: completed.filter((a) => a.risk_level === "HIGH").length },
    { name: "Critical", value: completed.filter((a) => a.risk_level === "CRITICAL").length },
  ];

  const trend = completed.slice(0, 6).map((a, idx) => ({
    label: `A${idx + 1}`,
    score: a.overall_score ?? 0,
  }));

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-white">Fairness overview</h1>
          <p className="text-sm text-white/60">Live metrics from the FastAPI audit engine.</p>
        </div>
        <Button asChild data-testid="dashboard-new-audit">
          <Link href="/audit/new">+ New audit</Link>
        </Button>
      </div>

      {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat title="Total Audits" value={loading ? "…" : String(audits.length)} />
        <Stat title="Datasets" value={loading ? "…" : String(new Set(audits.map((a) => a.dataset_id)).size)} />
        <Stat title="At Risk" value={loading ? "…" : String(atRisk)} />
        <Stat title="Avg Score" value={loading ? "…" : `${Math.round(avgScore)}/100`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle className="text-sm text-white">Recent audits</CardTitle>
            <CardDescription>Latest fairness runs with severity badges.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white/80">
              <thead className="text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Risk</th>
                  <th className="pb-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {audits.slice(0, 8).map((a) => (
                  <tr key={a.id} className="border-t border-white/10 transition-colors hover:bg-white/5">
                    <td className="py-2">
                      <Link className="text-white hover:text-white/80 hover:underline" href={`/audit/${a.id}`}>
                        {a.name}
                      </Link>
                    </td>
                    <td className="py-2 text-white/60">{a.status}</td>
                    <td className="py-2">
                      <RiskBadge risk={a.risk_level ?? "MEDIUM"} />
                    </td>
                    <td className="py-2 font-mono text-xs">{a.overall_score?.toFixed(0) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle className="text-sm text-white">Risk mix</CardTitle>
            <CardDescription>Donut of completed audits by coarse risk label.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {riskData.map((entry, index) => (
                    <Cell key={entry.name} fill={["#10B981", "#F59E0B", "#EF4444", "#7F1D1D"][index % 4]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(17,24,39,0.85)", border: "none", color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle className="text-sm text-white">Fairness score trend</CardTitle>
            <CardDescription>Most recent completed audits (prototype ordering).</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.14)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" />
                <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.4)" />
                <Tooltip contentStyle={{ background: "rgba(17,24,39,0.85)", border: "none", color: "#fff" }} />
                <Line type="monotone" dataKey="score" stroke="#f9fafb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card className="rounded-2xl p-5" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader>
        <CardDescription className="text-xs uppercase tracking-widest text-white/50">{title}</CardDescription>
        <CardTitle className="font-mono text-3xl text-white">{value}</CardTitle>
        <p className="text-xs text-white/40">Live from the current workspace session</p>
      </CardHeader>
    </Card>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  if (risk === "CRITICAL") {
    return <span className="liquid-glass-danger glass-pill text-xs text-red-300">{risk}</span>;
  }
  if (risk === "HIGH") {
    return <span className="liquid-glass-warning glass-pill text-xs text-amber-300">{risk}</span>;
  }
  if (risk === "LOW") {
    return <span className="liquid-glass-success glass-pill text-xs text-emerald-300">{risk}</span>;
  }
  return <span className="liquid-glass glass-pill text-xs text-white/70">{risk}</span>;
}
