"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface GroupComparisonChartProps {
  title: string;
  data: Array<{ group: string; rate: number; kind: "privileged" | "other" }>;
}

/**
 * Grouped bar chart comparing outcome rates with privileged vs other styling.
 */
export function GroupComparisonChart({ title, data }: GroupComparisonChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    fill: d.kind === "privileged" ? "#3B82F6" : "#F59E0B",
  }));

  return (
    <div className="h-72 w-full" data-testid="group-comparison-chart">
      <div className="mb-2 text-sm font-medium text-foreground">{title}</div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
          <XAxis dataKey="group" stroke="#6B7280" />
          <YAxis stroke="#6B7280" domain={[0, 1]} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
          <Tooltip
            formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, "Rate"]}
            contentStyle={{ background: "#0D1422", border: "1px solid #1F2937", borderRadius: 8 }}
          />
          <Legend />
          <Bar dataKey="rate" name="Positive rate" radius={[6, 6, 0, 0]} isAnimationActive>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${entry.group}-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
