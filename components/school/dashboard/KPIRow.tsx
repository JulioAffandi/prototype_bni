import React from "react";
import { KPISparklineCard } from "./KPISparklineCard";
import type { KpiMetric } from "@/lib/school/dashboard-types";

interface KPIRowProps {
  metrics: KpiMetric[];
  className?: string;
}

export function KPIRow({ metrics, className = "" }: KPIRowProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 ${className}`}>
      {metrics.map((m) => (
        <KPISparklineCard
          key={m.id}
          id={m.id}
          label={m.label}
          sublabel={m.sublabel}
          formattedValue={m.formattedValue}
          deltaPct={m.deltaPct}
          comparisonLabel={m.comparisonLabel}
          series={m.series}
          accent={m.accent}
          invertPolarity={m.invertPolarity}
          className="h-[115px]"
        />
      ))}
    </div>
  );
}
