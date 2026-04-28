"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export interface BiasGaugeProps {
  value: number;
  label?: string;
}

/**
 * Animated radial fairness gauge from 0–100 with clinical color coding.
 */
export function BiasGauge({ value, label = "Fairness" }: BiasGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = useMemo(() => {
    if (clamped >= 80) return "#10B981";
    if (clamped >= 60) return "#F59E0B";
    return "#EF4444";
  }, [clamped]);

  const r = 52;
  const c = 2 * Math.PI * r;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDisplay(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className="relative h-40 w-40" data-testid="bias-gauge">
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
        <circle cx="80" cy="80" r={r} stroke="#1F2937" strokeWidth="10" fill="none" />
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - display / 100) }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-3xl font-semibold text-foreground">{Math.round(display)}</div>
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      </div>
    </div>
  );
}
