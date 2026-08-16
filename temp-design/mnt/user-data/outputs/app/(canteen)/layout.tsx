import type { ReactNode } from "react";
import { TopBar } from "./_components/TopBar";

export default function CanteenLayout({ children }: { children: ReactNode }) {
  return (
    <div data-portal="canteen" className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
}
