export const CHART_COLORS = {
  INFLOW: "#059669",
  INFLOW_SOFT: "rgba(5, 150, 105, 0.12)",
  OUTFLOW: "#EA580C",
  OUTFLOW_SOFT: "rgba(234, 88, 12, 0.12)",
  NET: "#4338CA",
  NET_SOFT: "rgba(67, 56, 202, 0.12)",
  CRITICAL: "#E11D48",
  ATTENTION: "#D97706",
  INFO: "#2563EB",
  GRID: "#F1F5F9",
  TEXT_MUTED: "#64748B",
  CARD_BG: "#FFFFFF",
} as const;

export const CHART_CONFIG = {
  margin: { top: 10, right: 10, left: -20, bottom: 0 },
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
} as const;
