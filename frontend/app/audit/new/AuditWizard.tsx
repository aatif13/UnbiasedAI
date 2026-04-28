"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AuditProgressTracker } from "@/components/audit/AuditProgressTracker";
import { DatasetUploader } from "@/components/audit/DatasetUploader";
import { runAudit } from "@/lib/api";
import type { AuditRecord, ColumnProfile, UploadResponse } from "@/types/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Step = 1 | 2 | 3;

function placeholderForSensitiveAttr(attr: string): string {
  const key = attr.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (key.includes("age")) return "e.g. 42";
  if (key.includes("sex") || key.includes("gender")) return "e.g. male";
  if (key.includes("race") || key.includes("ethnicity")) return "e.g. white";
  if (key.includes("income") || key.includes("salary") || key.includes("wage")) return "e.g. 2";
  if (key.includes("country") || key.includes("nationality")) return "e.g. india";
  return "e.g. privileged value";
}

/**
 * Multi-step audit wizard: upload, configure, run.
 */
export function AuditWizard() {
  const [step, setStep] = useState<Step>(1);
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [target, setTarget] = useState<string>("");
  const [sensitive, setSensitive] = useState<string[]>([]);
  const [privileged, setPrivileged] = useState<Record<string, string>>({});
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [finished, setFinished] = useState<AuditRecord | null>(null);

  const handleComplete = useCallback((rec: AuditRecord) => {
    setFinished(rec);
  }, []);

  const columns = useMemo(() => upload?.columns ?? [], [upload]);

  const toggleSensitive = (name: string) => {
    setSensitive((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">New audit</p>
          <h1 className="text-2xl font-medium text-white">Fairness audit wizard</h1>
        </div>
        <div className="text-xs text-white/60">Step {step} / 3</div>
      </div>
      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2, 3].map((n, idx) => (
          <div key={n} className="flex items-center gap-2">
            <span
              className={
                n < step
                  ? "liquid-glass-success flex h-8 w-8 items-center justify-center rounded-full text-xs text-emerald-300"
                  : n === step
                    ? "liquid-glass-strong flex h-8 w-8 items-center justify-center rounded-full text-xs text-white"
                    : "liquid-glass flex h-8 w-8 items-center justify-center rounded-full text-xs text-white/40"
              }
            >
              {n < step ? "✓" : n}
            </span>
            {idx < 2 ? <span className="h-px w-10 bg-white/20" /> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <Card className="mx-auto mt-4 max-w-3xl rounded-3xl p-8">
          <CardHeader>
            <CardTitle>Upload dataset</CardTitle>
            <CardDescription>CSV, JSON, or Excel — sensitive columns are auto-highlighted after upload.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DatasetUploader
              onUploaded={(res) => {
                setUpload(res);
                const guess = res.sensitive_detections.map((d) => d.column);
                setSensitive(guess);
              }}
            />
            {upload ? (
              <div className="space-y-3">
                <div className="text-sm text-muted">Preview</div>
                <div className="liquid-glass overflow-x-auto rounded-2xl">
                  <table className="min-w-full text-left text-xs">
                    <thead className="text-white/50">
                      <tr>
                        <th className="px-3 py-2">Column</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Nulls</th>
                        <th className="px-3 py-2">Unique</th>
                        <th className="px-3 py-2">Sensitive?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((c: ColumnProfile) => (
                        <tr key={c.name} className="border-t border-white/10">
                          <td className="px-3 py-2 font-mono text-[11px] text-white">{c.name}</td>
                          <td className="px-3 py-2 text-white/60">{c.dtype}</td>
                          <td className="px-3 py-2 text-white/60">{c.null_count}</td>
                          <td className="px-3 py-2 text-white/60">{c.unique_values}</td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={sensitive.includes(c.name)}
                              onChange={() => toggleSensitive(c.name)}
                              data-testid={`sensitive-toggle-${c.name}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button type="button" onClick={() => setStep(2)} disabled={!upload} data-testid="wizard-next-1">
                  Continue
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && upload ? (
        <Card className="mx-auto mt-4 max-w-3xl rounded-3xl p-8">
          <CardHeader>
            <CardTitle>Configure audit</CardTitle>
            <CardDescription>Select the outcome column, confirm sensitive fields, and privileged baselines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="liquid-glass rounded-2xl p-4">
              <label className="mb-2 block text-xs uppercase tracking-wider text-white/50" htmlFor="target">
                Target / outcome column
              </label>
              <select
                id="target"
                className="liquid-glass w-full rounded-xl px-4 py-3 text-sm text-white"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                data-testid="wizard-target"
              >
                <option value="" className="bg-[#111827] text-white/80">
                  Select…
                </option>
                {columns.map((c) => (
                  <option key={c.name} value={c.name} className="bg-[#111827] text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="liquid-glass rounded-2xl p-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Sensitive attributes</div>
              <div className="flex flex-wrap gap-2">
                {sensitive.map((s) => (
                  <span key={s} className="liquid-glass glass-pill text-xs text-white/80">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="liquid-glass rounded-2xl p-4">
              <div className="mb-3 text-xs uppercase tracking-wider text-white/50">Privileged group per attribute</div>
              {sensitive.map((s) => (
                <div key={s} className="flex flex-col gap-1">
                  <label className="text-xs text-white/50" htmlFor={`priv-${s}`}>
                    {s}
                  </label>
                  <input
                    id={`priv-${s}`}
                    className="liquid-glass rounded-xl px-3 py-2 text-xs text-white"
                    placeholder={placeholderForSensitiveAttr(s)}
                    value={privileged[s] ?? ""}
                    onChange={(e) => setPrivileged((p) => ({ ...p, [s]: e.target.value }))}
                    data-testid={`privileged-${s}`}
                  />
                </div>
              ))}
            </div>

            <div className="liquid-glass rounded-2xl p-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Audit depth</div>
              <div className="flex flex-wrap gap-2">
                {(["quick", "standard", "deep"] as const).map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={depth === d ? "default" : "secondary"}
                    onClick={() => setDepth(d)}
                    data-testid={`depth-${d}`}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)} data-testid="wizard-back-2">
                Back
              </Button>
              <Button
                type="button"
                disabled={!target || sensitive.length === 0}
                onClick={async () => {
                  const { audit_id } = await runAudit({
                    dataset_id: upload.dataset_id,
                    name: `Audit ${upload.dataset_id}`,
                    target_column: target,
                    sensitive_attrs: sensitive,
                    privileged_groups: privileged,
                    audit_depth: depth,
                    domain: "hiring",
                  });
                  setAuditId(audit_id);
                  setStep(3);
                }}
                data-testid="wizard-start-audit"
              >
                Run audit
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && auditId ? (
        <Card className="mx-auto mt-4 max-w-3xl rounded-3xl p-8">
          <CardHeader>
            <CardTitle>Running audit</CardTitle>
            <CardDescription>Live progress with staged fairness diagnostics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AuditProgressTracker auditId={auditId} onComplete={handleComplete} />
            {finished ? (
              <div className="flex items-center gap-3">
                <Button asChild data-testid="wizard-open-results">
                  <Link href={`/audit/${finished.id}`}>Open results</Link>
                </Button>
                <span className="text-xs text-white/50">Audit {finished.id}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}
