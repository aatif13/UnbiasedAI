"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import type { RemediationStrategy } from "@/types/audit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RemediationCardProps {
  strategy: RemediationStrategy;
  /** When true, adds a pulsing ring highlight (e.g. after “See fix” from a violation). */
  highlighted?: boolean;
  /** Opens the Apply & Preview modal for this strategy. */
  onApplyPreview?: () => void;
}

/**
 * Expandable remediation strategy with syntax-highlighted Python snippet.
 */
export function RemediationCard({ strategy, highlighted, onApplyPreview }: RemediationCardProps) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    if (!open || !strategy.code_snippet) return;
    let cancelled = false;
    void codeToHtml(strategy.code_snippet, {
      lang: "python",
      theme: "github-dark",
    }).then((h) => {
      if (!cancelled) setHtml(h);
    });
    return () => {
      cancelled = true;
    };
  }, [open, strategy.code_snippet]);

  return (
    <div
      className={cn(
        "liquid-glass rounded-2xl p-5",
        highlighted ? "liquid-glass-highlight" : "",
      )}
      data-testid={`remediation-${strategy.name}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">{strategy.name}</div>
          <div className="mt-1 text-sm text-white/60">{strategy.description}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="liquid-glass glass-pill text-white/50">Effort: {strategy.effort}</span>
            <span className="liquid-glass glass-pill text-white/50">Impact: {strategy.impact}</span>
            <span className="liquid-glass glass-pill text-white/50">Library: {strategy.library}</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={() => setOpen((v) => !v)} data-testid="toggle-snippet">
          {open ? (
            <>
              Hide snippet <ChevronUp className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              View snippet <ChevronDown className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      {open && strategy.code_snippet ? (
        <div
          className="liquid-glass mt-3 overflow-x-auto rounded-xl p-3 text-xs text-white/80"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html || "<pre>Loading highlighter…</pre>" }}
        />
      ) : null}
      {open && !strategy.code_snippet ? (
        <div className="mt-3 text-xs text-white/50">No runnable snippet bundled for this strategy in the demo dataset.</div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="default"
          type="button"
          data-testid="apply-remediation-preview"
          onClick={() => onApplyPreview?.()}
        >
          Apply &amp; Preview
        </Button>
      </div>
    </div>
  );
}
