import type { ReactNode } from "react";
import { Sidebar } from "./_components/Sidebar";

export default function SchoolLayout({ children }: { children: ReactNode }) {
  return (
    <div data-portal="school" className="flex min-h-screen">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-portal-border bg-portal-surface px-6">
          <span className="font-portal-mono text-xs uppercase tracking-wider text-portal-muted">
            VALO · School Treasury Console
          </span>
          <span className="rounded-portal border border-portal-border px-2.5 py-1 text-xs font-medium text-portal-text">
            Admin
          </span>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
