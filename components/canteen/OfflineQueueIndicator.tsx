"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { getPendingCount, syncQueueWhenOnline } from "@/lib/offlineQueue";

export default function OfflineQueueIndicator() {
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function refresh() {
      const n = await getPendingCount();
      setCount(n);
    }
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSync() {
    setSyncing(true);
    await syncQueueWhenOnline();
    const n = await getPendingCount();
    setCount(n);
    setSyncing(false);
  }

  if (count === 0) return null;

  return (
    <button
      id="offline-queue-sync-btn"
      onClick={handleSync}
      disabled={syncing}
      aria-label={`${count} transaksi offline — klik untuk sinkronisasi`}
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl badge-offline text-xs font-medium"
    >
      {syncing ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <CloudOff className="w-3.5 h-3.5" />
      )}
      <span>{count}</span>
    </button>
  );
}
