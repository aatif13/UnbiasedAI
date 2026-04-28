"use client";

import { useEffect, useState } from "react";
import { getAuditResults, pollAuditStatus } from "@/lib/api";
import type { AuditRecord } from "@/types/audit";

export interface AuditProgressTrackerProps {
  auditId: string;
  onComplete: (record: AuditRecord) => void;
}

const STEPS = [
  "Analyzing data distribution…",
  "Computing demographic parity…",
  "Running equalized odds analysis…",
  "Detecting intersectional bias…",
  "Generating remediations…",
];

/**
 * Polls audit status and surfaces live progress messaging for the wizard.
 */
export function AuditProgressTracker({ auditId, onComplete }: AuditProgressTrackerProps) {
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("Queued…");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await pollAuditStatus(auditId);
        if (cancelled) return;
        setPercent(s.progress_percent);
        setMessage(s.message || STEPS[Math.min(STEPS.length - 1, Math.floor(s.progress_percent / 20))]);
        if (s.status === "COMPLETED") {
          const full = await getAuditResults(auditId);
          onComplete(full);
          return;
        }
        if (s.status === "FAILED") {
          setMessage("Audit failed — see details on results page.");
          return;
        }
      } catch {
        setMessage("Lost connection — retrying…");
      }
      setTimeout(tick, 1200);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [auditId, onComplete]);

  return (
    <div className="space-y-3" data-testid="audit-progress-tracker">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>{message}</span>
        <span className="font-mono">{percent}%</span>
      </div>
      <div className="liquid-glass h-2 w-full overflow-hidden rounded-full">
        <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <ul className="grid gap-2 text-xs text-white/60 md:grid-cols-2">
        {STEPS.map((step) => (
          <li key={step} className="liquid-glass rounded-2xl px-3 py-2">
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}
