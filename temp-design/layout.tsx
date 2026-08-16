import type { ReactNode } from "react";
import { BottomDock } from "./_components/BottomDock";

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <div data-portal="parent" className="relative min-h-screen pb-28">
      {/* Soft radial glow di belakang hero balance — signature Parent Hub */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 animate-glow-pulse"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, var(--portal-primary) 0%, transparent 70%)",
        }}
      />

      <main className="relative mx-auto w-full max-w-md px-4 pt-6">
        {children}
      </main>

      <BottomDock />
    </div>
  );
}
