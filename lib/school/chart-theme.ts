export const CHART_COLORS = {
  INFLOW: "#5B4BDB",
  INFLOW_SOFT: "rgba(91, 75, 219, 0.15)",
  OUTFLOW: "#F97316",
  OUTFLOW_SOFT: "rgba(249, 115, 22, 0.15)",
  NET: "#84CC16",
  NET_SOFT: "rgba(132, 204, 22, 0.15)",
  CRITICAL: "#EF4444",
  ATTENTION: "#F59E0B",
  INFO: "#3B82F6",
  GRID: "#1E293B",
  TEXT_MUTED: "#94A3B8",
  CARD_BG: "#161F30",
} as const;

export const CHART_CONFIG = {
  margin: { top: 10, right: 10, left: -20, bottom: 0 },
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
} as const;
