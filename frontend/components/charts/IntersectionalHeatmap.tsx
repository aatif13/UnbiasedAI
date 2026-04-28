"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IntersectionalAnalysis } from "@/types/audit";

export interface IntersectionalHeatmapProps {
  analysis: IntersectionalAnalysis;
}

/**
 * D3-backed heatmap for intersectional selection rates.
 */
export function IntersectionalHeatmap({ analysis }: IntersectionalHeatmapProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const matrix = useMemo(() => {
    const cells = analysis.cells ?? [];
    const a0s = Array.from(new Set(cells.map((c) => c.a0))).sort();
    const a1s = Array.from(new Set(cells.map((c) => c.a1))).sort();
    return { cells, a0s, a1s };
  }, [analysis.cells]);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const width = 520;
    const height = 360;
    const margin = { top: 40, right: 20, bottom: 40, left: 120 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const { a0s, a1s, cells } = matrix;
    const x = d3.scaleBand().domain(a1s).range([0, innerW]).padding(0.08);
    const y = d3.scaleBand().domain(a0s).range([0, innerH]).padding(0.08);
    const values = cells.map((c) => c.selection_rate).filter((v) => Number.isFinite(v));
    const color = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([d3.min(values) ?? 0, d3.max(values) ?? 1]);

    const root = d3.select(svg);
    root.selectAll("*").remove();

    const g = root.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.selectAll("rect")
      .data(cells)
      .join("rect")
      .attr("x", (d) => x(d.a1) ?? 0)
      .attr("y", (d) => y(d.a0) ?? 0)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", (d) => (Number.isFinite(d.selection_rate) ? color(d.selection_rate) : "#111827"))
      .attr("stroke", "#1F2937")
      .style("cursor", "pointer")
      .on("mousemove", (event, d) => {
        const [px, py] = d3.pointer(event, svg);
        const rate = Number.isFinite(d.selection_rate) ? `${(d.selection_rate * 100).toFixed(1)}%` : "n/a";
        setTip({
          x: px,
          y: py,
          text: `${d.a0} × ${d.a1}: ${rate} (n=${d.n})`,
        });
      })
      .on("mouseleave", () => setTip(null));

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("fill", "#9CA3AF");

    g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .attr("fill", "#9CA3AF");
  }, [matrix]);

  return (
    <div className="relative w-full overflow-x-auto" data-testid="intersectional-heatmap">
      <svg ref={ref} className="h-[360px] w-full max-w-[640px]" />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-bg-secondary px-2 py-1 text-xs text-foreground shadow-lg"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
