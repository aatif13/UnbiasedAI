"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

/**
 * Animated D3 visualization morphing between skewed and balanced outcome densities.
 */
export function HeroBiasMorph() {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const width = 640;
    const height = 260;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xs = d3.range(0, 121).map((i) => -3 + (6 * i) / 120);
    const x = d3.scaleLinear().domain([-3, 3]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 0.6]).range([innerH, 0]);

    const normal = (xv: number, mu: number, sigma: number) =>
      Math.exp(-0.5 * Math.pow((xv - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI));

    const root = d3.select(svg);
    root.selectAll("*").remove();
    const g = root.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const linePath = g.append("path").attr("fill", "none").attr("stroke", "#3B82F6").attr("stroke-width", 3);
    const areaPath = g
      .append("path")
      .attr("fill", "rgba(245,158,11,0.12)")
      .attr("stroke", "#F59E0B")
      .attr("stroke-width", 1.5);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6))
      .selectAll("text")
      .attr("fill", "#9CA3AF");
    g.append("g")
      .call(d3.axisLeft(y).ticks(4, "%"))
      .selectAll("text")
      .attr("fill", "#9CA3AF");

    const timer = d3.interval(() => {
      const mix = (Math.sin(Date.now() / 1500) + 1) / 2;
      const ys = xs.map((xv) => {
        const skewed = normal(xv, 0.9, 0.75);
        const balanced = normal(xv, 0, 1);
        return skewed * (1 - mix) + balanced * mix;
      });

      const line = d3
        .line<number>()
        .x((_d, i) => x(xs[i] ?? 0))
        .y((d) => y(d))
        .curve(d3.curveMonotoneX);

      const area = d3
        .area<number>()
        .x((_d, i) => x(xs[i] ?? 0))
        .y0(innerH)
        .y1((d) => y(d))
        .curve(d3.curveMonotoneX);

      linePath.datum(ys).attr("d", line);
      areaPath.datum(ys).attr("d", area);
    }, 40);

    return () => timer.stop();
  }, []);

  return (
    <div className="relative w-full" data-testid="hero-bias-morph">
      <svg ref={ref} className="h-[260px] w-full max-w-[640px]" />
      <div className="pointer-events-none absolute left-4 top-2 rounded-md bg-bg-card/70 px-2 py-1 text-xs text-muted">
        Live morph: biased → balanced outcome density
      </div>
    </div>
  );
}
