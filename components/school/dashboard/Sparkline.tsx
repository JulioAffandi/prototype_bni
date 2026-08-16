"use client";

import { ResponsiveContainer, AreaChart, Area } from "recharts";

interface SparklineProps {
  data: number[];
  stroke?: string;
  fill?: string;
  height?: number;
}

export function Sparkline({
  data,
  stroke = "#5B4BDB",
  fill = "rgba(91, 75, 219, 0.15)",
  height = 36,
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ height }} className="w-full" />;
  }

  const chartData = data.map((val, idx) => ({ idx, val }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`sparkGrad-${stroke.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="val"
            stroke={stroke}
            strokeWidth={1.8}
            fill={fill || `url(#sparkGrad-${stroke.replace(/[^a-zA-Z0-9]/g, "")})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
