"use client";

import { Info } from "lucide-react";
import type { MetricStatus } from "@/types/audit";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface FairnessMetricCardProps {
  name: string;
  value: number;
  threshold: number;
  status: MetricStatus;
  description: string;
  formula: string;
  learnMoreUrl?: string;
}

function badge(status: MetricStatus) {
  if (status === "PASS") return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40";
  if (status === "WARN") return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40";
  return "bg-red-500/15 text-red-300 ring-1 ring-red-500/40";
}

/**
 * Compact card for a single fairness metric with tooltip context.
 */
export function FairnessMetricCard({
  name,
  value,
  threshold,
  status,
  description,
  formula,
  learnMoreUrl,
}: FairnessMetricCardProps) {
  return (
    <TooltipProvider>
      <div
        className="flex flex-col gap-2 rounded-lg border border-border bg-bg-secondary/60 p-4"
        data-testid={`metric-card-${name.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">{name}</div>
            <div className="font-mono text-lg text-accent-blue">{value.toFixed(3)}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge(status))}>{status}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted hover:bg-bg-card hover:text-foreground"
                  aria-label={`About ${name}`}
                  data-testid={`metric-info-${name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-2">
                  <p>{description}</p>
                  <p className="font-mono text-[11px] text-muted">{formula}</p>
                  {learnMoreUrl ? (
                    <a className="text-accent-blue underline" href={learnMoreUrl} target="_blank" rel="noreferrer">
                      Learn more
                    </a>
                  ) : null}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="text-xs text-muted">Threshold: {threshold}</div>
      </div>
    </TooltipProvider>
  );
}
