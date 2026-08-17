import type { Config } from "tailwindcss";

/**
 * VALO BNI — Role-Based Design Token System
 * ------------------------------------------------------------------
 * Semua warna/typography/radius portal TIDAK di-hardcode per role.
 * Sebaliknya, mereka resolve lewat CSS variable `--portal-*` yang
 * di-scope lewat attribute `data-portal="parent|school|canteen"`
 * (lihat app/globals.css).
 *
 * Konsekuensinya: komponen shared (Button, Card, Badge, dll) cukup
 * pakai class semantik `bg-portal-primary`, `text-portal-muted`,
 * dsb — otomatis "berganti kulit" sesuai portal aktif tanpa perlu
 * variant/prop tambahan atau duplikasi komponen.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        portal: {
          bg: "var(--portal-bg)",
          surface: "var(--portal-surface)",
          "surface-alt": "var(--portal-surface-alt)",
          border: "var(--portal-border)",
          primary: "var(--portal-primary)",
          "primary-foreground": "var(--portal-primary-foreground)",
          secondary: "var(--portal-secondary)",
          accent: "var(--portal-accent)",
          success: "var(--portal-success)",
          warning: "var(--portal-warning)",
          danger: "var(--portal-danger)",
          text: "var(--portal-text)",
          muted: "var(--portal-text-muted)",
        },
      },
      fontFamily: {
        "portal-sans": ["var(--portal-font-sans)"],
        "portal-mono": ["var(--portal-font-mono)"],
      },
      borderRadius: {
        portal: "var(--portal-radius)",
        "portal-lg": "var(--portal-radius-lg)",
      },
      backgroundImage: {
        "portal-gradient": "var(--portal-gradient-primary)",
      },
      boxShadow: {
        "portal-glow": "var(--portal-glow)",
        "portal-card": "var(--portal-card-shadow)",
      },
      minHeight: {
        // Oversized touch target — wajib untuk Canteen POS (48-64px)
        tap: "48px",
        "tap-lg": "64px",
      },
      minWidth: {
        tap: "48px",
        "tap-lg": "64px",
      },
      keyframes: {
        "nfc-flash": {
          "0%": { opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "nfc-flash": "nfc-flash 600ms ease-out",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
