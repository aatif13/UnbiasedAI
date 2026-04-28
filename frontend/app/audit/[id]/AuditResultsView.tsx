"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { AppShell } from "@/components/layout/AppShell";
import { RemediationPreviewModal } from "@/components/audit/RemediationPreviewModal";
import { RemediationCard } from "@/components/audit/RemediationCard";
import { BiasGauge } from "@/components/charts/BiasGauge";
import { FairnessMetricCard } from "@/components/charts/FairnessMetricCard";
import { GroupComparisonChart } from "@/components/charts/GroupComparisonChart";
import { IntersectionalHeatmap } from "@/components/charts/IntersectionalHeatmap";
import { ApiError, getAuditResults } from "@/lib/api";
import type { AuditMetricBlock, AuditRecord, MetricStatus, RemediationStrategy } from "@/types/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Maps a violation rule title to remediation card names (must match backend strategy names). */
function remediationNamesForViolationRule(rule: string, allStrategyNames: string[]): string[] {
  let mapped: string[];
  if (rule === "EEOC 80% Rule") {
    mapped = ["Disparate Impact Remover", "Reweighing"];
  } else if (rule === "Demographic Parity") {
    mapped = ["Exponentiated Gradient Reduction", "Reweighing"];
  } else if (rule === "Equalized Odds") {
    mapped = ["Calibrated Equalized Odds", "Exponentiated Gradient Reduction"];
  } else if (rule === "Equal Opportunity" || rule.includes("Equal Opportunity")) {
    mapped = ["Threshold Optimizer", "Exponentiated Gradient Reduction"];
  } else if (rule.includes("False Positive Rate")) {
    mapped = ["Calibrated Equalized Odds", "Threshold Optimizer"];
  } else {
    return [...allStrategyNames];
  }
  const present = mapped.filter((n) => allStrategyNames.includes(n));
  return present.length > 0 ? present : [...allStrategyNames];
}

function statusForMetric(name: string, value: number | undefined, threshold: number): MetricStatus {
  if (value === undefined || Number.isNaN(value)) return "WARN";
  if (name.includes("disparate")) {
    return value < 0.8 ? "FAIL" : value < 0.9 ? "WARN" : "PASS";
  }
  const abs = Math.abs(value);
  return abs > threshold ? "FAIL" : abs > threshold * 0.7 ? "WARN" : "PASS";
}

/**
 * Full audit results surface with tabs, charts, remediation, and simulation controls.
 */
export function AuditResultsView({ auditId }: { auditId: string }) {
  const [record, setRecord] = useState<AuditRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sim, setSim] = useState(40);
  const remediationRef = useRef<HTMLElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [highlightedCards, setHighlightedCards] = useState<string[]>([]);
  const [previewModal, setPreviewModal] = useState<{ open: boolean; strategy: string | null }>({
    open: false,
    strategy: null,
  });

  const handleSeeFix = useCallback(
    (rule: string) => {
      if (!record) {
        return;
      }
      const allNames = (record.remediations ?? []).map((r) => r.name);
      const next = remediationNamesForViolationRule(rule, allNames);
      setHighlightedCards(next);
      window.requestAnimationFrame(() => {
        remediationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (highlightTimeoutRef.current != null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedCards([]);
        highlightTimeoutRef.current = null;
      }, 3000);
    },
    [record],
  );

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current != null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getAuditResults(auditId);
        if (!cancelled) setRecord(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.body : "Unable to load audit");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auditId]);

  const attrs = useMemo(() => {
    if (!record?.metrics) return [];
    return Object.keys(record.metrics).filter((k) => !k.startsWith("_"));
  }, [record]);

  const heatmapAnalysis = useMemo(() => {
    if (!record?.metrics) return { axes: [] as string[], cells: [] };
    for (const a of attrs) {
      const block = record.metrics?.[a] as AuditMetricBlock | undefined;
      const cells = block?.intersectional_analysis?.cells ?? [];
      if (cells.length) return block!.intersectional_analysis!;
    }
    const first = record.metrics[attrs[0]] as AuditMetricBlock | undefined;
    return first?.intersectional_analysis ?? { axes: [], cells: [] };
  }, [attrs, record]);

  const baseScore = record?.overall_score ?? 0;
  const adjustedScore = Math.min(100, baseScore + sim * 0.15);

  if (error) {
    return (
      <AppShell>
        <div className="text-sm text-red-300">{error}</div>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <div className="animate-pulse text-sm text-muted">Loading audit…</div>
      </AppShell>
    );
  }

  const violations = attrs.flatMap((a) => {
    const block = record.metrics?.[a] as AuditMetricBlock | undefined;
    return (block?.violations ?? []).map((v) => ({ ...v, attribute: a }));
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Audit</p>
          <h1 className="text-2xl font-medium text-white">{record.name}</h1>
          <p className="text-xs text-white/50">{record.id}</p>
        </div>
        <Button asChild variant="secondary" data-testid="open-report">
          <Link href={`/reports/${record.id}`}>Open report</Link>
        </Button>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-[1.1fr,1fr]">
        <Card className="rounded-3xl p-8">
          <CardHeader>
            <CardTitle>Overall fairness score</CardTitle>
            <CardDescription>Composite index with animated gauge.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-6">
            <BiasGauge value={adjustedScore} />
            <div className="space-y-2 text-sm">
              <div className="text-3xl font-mono text-white">{Math.round(adjustedScore)} / 100</div>
              <div className="liquid-glass glass-pill inline-flex text-xs text-white/70">Risk: {record.risk_level ?? "—"}</div>
              <div className="text-xs text-white/60">
                {violations.length} flagged issues across sensitive attributes (live values from API).
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle>Violations</CardTitle>
            <CardDescription>Threshold breaches with legal / ethical context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {violations.length === 0 ? (
              <div className="text-sm text-white/60">No violations detected for configured thresholds.</div>
            ) : (
              violations.map((v, idx) => (
                <div
                  key={`${v.rule}-${idx}`}
                  className={`${v.severity === "CRITICAL" ? "liquid-glass-danger" : "liquid-glass-warning"} rounded-2xl p-4 text-sm`}
                >
                  <div className={`glass-pill inline-flex text-xs ${v.severity === "CRITICAL" ? "text-red-300" : "text-amber-300"}`}>
                    {v.severity}
                  </div>
                  <div className="mt-1 text-base font-medium text-white">{v.rule}</div>
                  <div className="text-sm text-white/60">{v.description}</div>
                  <div className="liquid-glass glass-pill mt-2 inline-flex text-xs text-white/50">Attribute: {v.attribute}</div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" type="button" data-testid={`violation-details-${idx}`}>
                      View details
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      data-testid={`violation-fix-${idx}`}
                      onClick={() => handleSeeFix(v.rule)}
                    >
                      See fix
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle>Metrics deep dive</CardTitle>
            <CardDescription>Per-attribute diagnostics with pass / warn / fail badges.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs.Root defaultValue={attrs[0]} className="space-y-4">
              <Tabs.List className="flex flex-wrap gap-2">
                {attrs.map((a) => (
                  <Tabs.Trigger
                    key={a}
                    value={a}
                    className="liquid-glass glass-pill px-3 py-1 text-xs text-white/60 data-[state=active]:bg-white/10 data-[state=active]:text-white"
                    data-testid={`tab-${a}`}
                  >
                    {a}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {attrs.map((a) => {
                const block = record.metrics?.[a] as AuditMetricBlock;
                if (!block) return null;
                const sr = block.selection_rate_by_group ?? {};
                const privilegedGuess = Object.keys(sr)[0];
                const chartData = Object.entries(sr).map(([group, rate]) => ({
                  group,
                  rate,
                  kind: group === privilegedGuess ? ("privileged" as const) : ("other" as const),
                }));
                return (
                  <Tabs.Content key={a} value={a} className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <FairnessMetricCard
                        name="Demographic parity Δ"
                        value={block.demographic_parity_difference ?? 0}
                        threshold={0.1}
                        status={statusForMetric("dp", block.demographic_parity_difference, 0.1)}
                        description="Difference between the largest and smallest selection rates across groups."
                        formula="|P(Ŷ=1|A=a) - P(Ŷ=1|A=b)| maximized over groups"
                      />
                      <FairnessMetricCard
                        name="Disparate impact"
                        value={block.disparate_impact_ratio ?? 1}
                        threshold={0.8}
                        status={statusForMetric("disparate", block.disparate_impact_ratio, 0.8)}
                        description="Ratio of lowest to highest positive outcome rate — EEOC four-fifths reference at 0.8."
                        formula="min_g P(Y=1|g) / max_g P(Y=1|g)"
                      />
                      <FairnessMetricCard
                        name="Equalized odds Δ"
                        value={block.equalized_odds_difference ?? 0}
                        threshold={0.1}
                        status={statusForMetric("eo", block.equalized_odds_difference, 0.1)}
                        description="Maximum gap in TPR/FPR between groups — lower is better."
                        formula="Fairlearn reduction metric across sensitive groups"
                      />
                    </div>
                    <GroupComparisonChart title={`Selection rate by group — ${a}`} data={chartData} />
                  </Tabs.Content>
                );
              })}
            </Tabs.Root>
          </CardContent>
        </Card>
      </section>

      {record.compliance && record.compliance.length > 0 ? (
        <section className="mt-8">
          <Card className="rounded-3xl p-6">
            <CardHeader>
              <CardTitle>Compliance context</CardTitle>
              <CardDescription>Informational mapping — not legal advice.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {record.compliance.map((c) => (
                <div key={String(c.name)} className="liquid-glass rounded-2xl p-3 text-sm">
                  <div className="text-xs uppercase text-white/50">{String(c.jurisdiction)}</div>
                  <div className="mt-1 font-medium text-white">{String(c.name)}</div>
                  <div className="mt-1 text-xs text-white/60">{String(c.description)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle>Intersectional view</CardTitle>
            <CardDescription>Heatmap across the first two sensitive attributes returned by the engine.</CardDescription>
          </CardHeader>
          <CardContent>
            <IntersectionalHeatmap analysis={heatmapAnalysis} />
          </CardContent>
        </Card>
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle>SHAP-style attributions</CardTitle>
            <CardDescription>Numeric surrogate attributions with proxy heuristics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {record.shap_values?.waterfall_preview?.map((w) => (
              <div key={w.feature} className="liquid-glass flex items-center justify-between rounded-xl px-2 py-1">
                <span className="font-mono text-xs text-white">{w.feature}</span>
                <span className="text-xs text-white/70">{w.value.toFixed(3)}</span>
              </div>
            ))}
            {record.shap_values?.proxy_flags?.length ? (
              <div className="mt-2 text-xs text-amber-300">Proxy flags: {record.shap_values.proxy_flags.map((p) => p.column).join(", ")}</div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section ref={remediationRef} className="mt-8">
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle>Remediation roadmap</CardTitle>
            <CardDescription>Prioritized strategies with runnable snippets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {(record.remediations ?? []).map((r: RemediationStrategy) => (
              <RemediationCard
                key={r.name}
                strategy={r}
                highlighted={highlightedCards.includes(r.name)}
                onApplyPreview={() => setPreviewModal({ open: true, strategy: r.name })}
              />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card className="rounded-3xl p-6">
          <CardHeader>
            <CardTitle>Before / after simulation</CardTitle>
            <CardDescription>Slide to preview post-remediation score lift (illustrative coupling to gauge).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="range"
              min={0}
              max={100}
              value={sim}
              onChange={(e) => setSim(Number(e.target.value))}
              className="w-full"
              data-testid="remediation-simulation-slider"
            />
            <div className="text-xs text-white/50">Illustrative adjustment: +{(sim * 0.15).toFixed(1)} pts to headline score.</div>
          </CardContent>
        </Card>
      </section>

      <RemediationPreviewModal
        open={previewModal.open}
        strategy={previewModal.strategy}
        record={record}
        onClose={() => setPreviewModal({ open: false, strategy: null })}
      />
    </AppShell>
  );
}
