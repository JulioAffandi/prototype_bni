import React from "react";
import { KPISparklineCard } from "./KPISparklineCard";
import type { KpiMetric } from "@/lib/school/dashboard-types";

interface KPIRowProps {
  metrics: KpiMetric[];
}

export function KPIRow({ metrics }: KPIRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
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
        />
      ))}
    </div>
  );
}
