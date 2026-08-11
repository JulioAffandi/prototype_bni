// =============================================================
// VALO Offline-First Queue — IndexedDB Local Storage
// Reference: PRODUCT_SPECIFICATION_v2.md §8.2, §8.3
// Uses: idb library (https://github.com/jakearchibald/idb)
// =============================================================

import { openDB, type IDBPDatabase } from "idb";
import type { OfflineQueuePayload, OfflineQueueSyncResult } from "@/types/database";

/** Offline pagu cache entry stored per student UID hash */
interface PaguCacheEntry {
  student_uid_hash: string;
  pagu_remaining: number;
  daily_limit: number;
  cached_at: number; // epoch ms
}

/** Entry stored in tx_queue object store */
interface QueuedTransaction extends OfflineQueuePayload {
  sync_status: "PENDING" | "SYNCED" | "CONFLICT";
}

const DB_NAME = "valo-pos-offline";
const DB_VERSION = 1;

/** 15-minute cache TTL per spec §8.2 rule 1 */
const PAGU_CACHE_TTL_MS = 15 * 60 * 1000;

/** Maximum percentage of daily_limit allowed offline — spec §8.2 rule 2 */
const OFFLINE_MAX_FRACTION = 0.5;

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("tx_queue")) {
        db.createObjectStore("tx_queue", { keyPath: "local_tx_uuid" });
      }
      if (!db.objectStoreNames.contains("pagu_cache")) {
        db.createObjectStore("pagu_cache", { keyPath: "student_uid_hash" });
      }
    },
  });

  return dbInstance;
}

// ─── Pagu Cache ───────────────────────────────────────────────

/** Cache the student's current pagu snapshot when online */
export async function cachePaguSnapshot(
  studentUidHash: string,
  paguRemaining: number,
  dailyLimit: number,
): Promise<void> {
  const db = await getDB();
  const entry: PaguCacheEntry = {
    student_uid_hash: studentUidHash,
    pagu_remaining: paguRemaining,
    daily_limit: dailyLimit,
    cached_at: Date.now(),
  };
  await db.put("pagu_cache", entry);
}

/** Check if cached pagu is still valid (within 15-minute TTL) */
export async function getCachedPagu(
  studentUidHash: string,
): Promise<PaguCacheEntry | null> {
  const db = await getDB();
  const entry = await db.get("pagu_cache", studentUidHash) as PaguCacheEntry | undefined;

  if (!entry) return null;
  if (Date.now() - entry.cached_at > PAGU_CACHE_TTL_MS) return null; // expired

  return entry;
}

// ─── Transaction Queue ────────────────────────────────────────

/**
 * Evaluate whether an offline transaction should be provisionally approved.
 * Rules: cache must be valid AND amount <= 50% of daily_limit (§8.2)
 */
export async function evaluateOfflineApproval(
  studentUidHash: string,
  amount: number,
): Promise<{ approved: boolean; reason?: string }> {
  const cache = await getCachedPagu(studentUidHash);

  if (!cache) {
    return { approved: false, reason: "Snapshot pagu kedaluwarsa atau tidak tersedia. Diperlukan koneksi online." };
  }

  if (amount > cache.pagu_remaining) {
    return { approved: false, reason: "Estimasi pagu lokal tidak mencukupi." };
  }

  const maxOfflineAmount = cache.daily_limit * OFFLINE_MAX_FRACTION;
  if (amount > maxOfflineAmount) {
    return { approved: false, reason: `Transaksi offline dibatasi maksimal ${formatRupiah(maxOfflineAmount)}. Diperlukan koneksi online.` };
  }

  return { approved: true };
}

/** Enqueue a transaction to IndexedDB for later sync */
export async function queueOfflineTransaction(
  tx: OfflineQueuePayload,
): Promise<void> {
  const db = await getDB();
  const queued: QueuedTransaction = { ...tx, sync_status: "PENDING" };
  await db.put("tx_queue", queued);
}

/** Get all pending (unsynced) transactions */
export async function getPendingTransactions(): Promise<QueuedTransaction[]> {
  const db = await getDB();
  const all = await db.getAll("tx_queue") as QueuedTransaction[];
  return all.filter((t) => t.sync_status === "PENDING");
}

/** Get pending transaction count (for offline indicator badge) */
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingTransactions();
  return pending.length;
}

/**
 * Sync pending transactions to server when connection is restored.
 * Implements exponential backoff retry is handled by the service worker.
 * Reference: §8.3
 */
export async function syncQueueWhenOnline(): Promise<OfflineQueueSyncResult[]> {
  const pending = await getPendingTransactions();
  if (pending.length === 0) return [];

  let results: OfflineQueueSyncResult[] = [];

  try {
    const res = await fetch("/api/v1/sync/offline-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: pending }),
    });

    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);

    results = (await res.json()) as OfflineQueueSyncResult[];

    // Clean successfully synced entries from IndexedDB
    const db = await getDB();
    for (const result of results) {
      if (result.status !== "CONFLICT") {
        await db.delete("tx_queue", result.local_tx_uuid);
      } else {
        // Keep CONFLICT in store for audit + merchant notification
        const existing = await db.get("tx_queue", result.local_tx_uuid) as QueuedTransaction;
        if (existing) {
          await db.put("tx_queue", { ...existing, sync_status: "CONFLICT" });
        }
      }
    }
  } catch {
    // Network error — remain queued, will retry on next 'online' event
  }

  return results;
}

// ─── Event listener registration (called once in POS layout) ──

/** Register background sync on window 'online' event */
export function registerOnlineSyncListener(
  onSyncComplete?: (results: OfflineQueueSyncResult[]) => void,
): () => void {
  const handler = async () => {
    const results = await syncQueueWhenOnline();
    onSyncComplete?.(results);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }

  return () => {};
}

// ─── Utility ──────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}
