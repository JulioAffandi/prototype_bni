"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  UtensilsCrossed,
  Nfc,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { usePosMachine, type ChargeCardResult } from "@/lib/pos/usePosMachine";
import type { MenuItem } from "@/lib/pos/posMachine";

interface PosTerminalClientProps {
  merchantId: string;
  menuItems: MenuItem[];
}

const ALL = "__ALL__";

/** DB categories arrive snake_case (`makanan_berat`); demo menu arrives Title Case. */
function categoryLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PosTerminalClient({ merchantId, menuItems }: PosTerminalClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);

  // --- Real / Simulated Charge Function ---
  async function chargeCard(amount: number): Promise<ChargeCardResult> {
    try {
      const res = await fetch("/api/v1/pos/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, amount }),
      });

      const data = (await res.json()) as ChargeCardResult;
      return data;
    } catch {
      return {
        success: false,
        error: {
          code: "READER_TIMEOUT",
          message: "Gagal terhubung ke server kasir.",
        },
      };
    }
  }

  const { state, dispatch, onCardTapped, isReaderArmed } = usePosMachine({
    chargeCard,
    merchantId,
  });

  // --- Dev Keyboard Simulator (Press 'T' while waiting for tap) ---
  useEffect(() => {
    if (!isReaderArmed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        onCardTapped();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReaderArmed, onCardTapped]);

  // --- Filtered Categories & Menu Items ---
  const availableItems = useMemo(
    () => menuItems.filter((m) => m.available),
    [menuItems]
  );

  const categories = useMemo(() => {
    const unique = Array.from(new Set(availableItems.map((m) => m.category).filter(Boolean)));
    return [
      { id: ALL, label: "Semua Menu" },
      ...unique.map((c) => ({ id: c, label: categoryLabel(c) })),
    ];
  }, [availableItems]);

  const filteredMenu = useMemo(
    () =>
      selectedCategory === ALL
        ? availableItems
        : availableItems.filter((m) => m.category === selectedCategory),
    [availableItems, selectedCategory]
  );

  const totalQty = state.cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 text-slate-900">
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. LEFT PANEL (65% Width) - MENU CATALOG                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[65%] flex flex-col h-full overflow-hidden p-4 sm:p-5 border-r border-slate-200/80">
        {/* Sticky Category Filter Bar */}
        <div className="shrink-0 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              aria-pressed={selectedCategory === cat.id}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                selectedCategory === cat.id
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 5-Column Grid of Menu Cards */}
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {filteredMenu.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
              <UtensilsCrossed className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Belum ada menu tersedia</p>
              <p className="text-xs text-slate-400">Pilih kategori lain atau kelola katalog menu.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-4">
              {filteredMenu.map((item) => {
                const inCart = state.cart.find((c) => c.id === item.id);
                const isLocked = state.status !== "building" && state.status !== "idle";

                return (
                  <button
                    key={item.id}
                    id={`menu-${item.id}`}
                    type="button"
                    disabled={!item.available || isLocked}
                    onClick={() => dispatch({ type: "ADD_ITEM", item })}
                    className={`group relative flex min-h-[96px] flex-col justify-between rounded-2xl border p-3 text-left shadow-xs transition-all duration-150 active:scale-[0.97] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      inCart
                        ? "border-orange-500 bg-orange-50/40 ring-2 ring-orange-500/20"
                        : "border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/20"
                    }`}
                  >
                    {/* Cart Quantity Badge */}
                    {inCart && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-extrabold text-white shadow-xs">
                        {inCart.qty}
                      </span>
                    )}

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        {categoryLabel(item.category)}
                      </span>
                      <h3 className="mt-0.5 line-clamp-2 text-xs font-bold text-slate-800 transition-colors group-hover:text-orange-600">
                        {item.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-auto">
                      <span className="text-xs font-extrabold text-orange-600 tabular-nums">
                        {formatRupiah(item.price)}
                      </span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                        <Plus size={12} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. RIGHT PANEL (35% Width) - CART & NFC GATE                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[35%] flex flex-col h-full bg-white p-4 sm:p-5 shadow-xs border-t lg:border-t-0 justify-between">
        {/* Cart Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
              <ShoppingCart size={16} />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">
                Ringkasan Pesanan
              </h2>
              <span className="text-[10px] text-slate-400 font-medium">
                {totalQty} item terpilih
              </span>
            </div>
          </div>

          {state.cart.length > 0 && state.status === "building" && (
            <button
              type="button"
              id="clear-cart-btn"
              onClick={() => dispatch({ type: "RESET_TO_IDLE" })}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Scrollable Cart Items Zone */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-2 pr-1 scrollbar-thin">
          {state.cart.length === 0 && state.status === "idle" && (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-300">
                <ShoppingCart size={22} />
              </div>
              <p className="text-xs font-semibold text-slate-600">Keranjang masih kosong</p>
              <p className="text-[11px] text-slate-400 max-w-[200px]">
                Pilih menu di katalog sebelah kiri untuk menambahkan pesanan.
              </p>
            </div>
          )}

          {state.cart.map((item) => {
            const isBuilding = state.status === "building" || state.status === "idle";
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-bold text-slate-900 truncate text-xs">{item.name}</p>
                  <p className="text-[11px] font-medium text-slate-500 tabular-nums">
                    {formatRupiah(item.price)} × {item.qty}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-extrabold text-slate-900 tabular-nums text-xs min-w-16 text-right">
                    {formatRupiah(item.price * item.qty)}
                  </span>

                  {/* Quantity Stepper */}
                  <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <button
                      type="button"
                      disabled={!isBuilding}
                      onClick={() =>
                        dispatch({
                          type: "UPDATE_QTY",
                          itemId: item.id,
                          qty: item.qty - 1,
                        })
                      }
                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="px-2 text-[11px] font-bold text-slate-800 tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      disabled={!isBuilding}
                      onClick={() =>
                        dispatch({
                          type: "UPDATE_QTY",
                          itemId: item.id,
                          qty: item.qty + 1,
                        })
                      }
                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fixed Bottom Zone: Totals & State Views */}
        <div className="border-t border-slate-100 pt-3 mt-auto shrink-0 space-y-3">
          {/* Subtotal & Total Display */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Subtotal Pesanan</span>
              <span className="font-semibold text-slate-700 tabular-nums">
                {formatRupiah(state.subtotal)}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                TOTAL TAGIHAN
              </span>
              <span className="text-2xl font-extrabold text-orange-600 tabular-nums">
                {formatRupiah(state.lockedTotal ?? state.subtotal)}
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* 8 UI STATES VISUALIZATION                                         */}
          {/* ══════════════════════════════════════════════════════════════════ */}

          {/* 1. IDLE (Empty cart) */}
          {state.status === "idle" && (
            <button
              type="button"
              disabled
              className="w-full rounded-xl bg-slate-100 text-slate-400 py-3.5 text-xs font-bold cursor-not-allowed text-center"
            >
              Pilih Menu untuk Memulai
            </button>
          )}

          {/* 2. BUILDING (Cart has items -> Primary Orange Button) */}
          {state.status === "building" && (
            <button
              type="button"
              id="lock-order-btn"
              onClick={() => dispatch({ type: "LOCK_ORDER" })}
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-98 text-white py-3.5 text-xs font-extrabold shadow-md shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock size={14} />
              <span>Kunci &amp; Terima Pembayaran</span>
            </button>
          )}

          {/* 3. LOCKED_WAITING_TAP (Emerald Pulsing NFC Ring) */}
          {state.status === "locked_waiting_tap" && (
            <div className="rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/60 p-4 text-center space-y-2.5">
              <div
                onClick={() => onCardTapped()}
                className="cursor-pointer group flex flex-col items-center"
                title="Klik atau tempelkan kartu NFC (Tekan 'T' untuk simulasi)"
              >
                <div className="relative flex items-center justify-center h-14 w-14 mb-1.5">
                  <div className="absolute h-14 w-14 rounded-full bg-emerald-300 opacity-60 animate-ping" />
                  <div className="relative h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                    <Nfc size={22} className="animate-pulse" />
                  </div>
                </div>

                <p className="font-extrabold text-xs text-emerald-900">
                  Tempelkan Kartu KTA NFC Siswa
                </p>
                <p className="text-[10px] text-emerald-700 font-medium">
                  Siap memproses <span className="font-bold">{formatRupiah(state.lockedTotal ?? state.subtotal)}</span>
                </p>
              </div>

              {process.env.NODE_ENV !== "production" && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 bg-white/80 py-1 px-2.5 rounded-lg border border-emerald-200">
                  <Sparkles size={11} className="text-amber-500" />
                  <span>Dev mode: Tekan tombol <kbd className="px-1 py-0.2 bg-slate-100 border rounded font-mono font-bold">T</kbd> untuk simulasi tap</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => dispatch({ type: "UNLOCK_ORDER" })}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-900 underline transition-colors cursor-pointer"
              >
                Batal / Edit Pesanan
              </button>
            </div>
          )}

          {/* 4. PROCESSING (Spinner) */}
          {state.status === "processing" && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 text-center space-y-2">
              <div className="mx-auto h-8 w-8 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
              <p className="font-bold text-xs text-slate-800">Memvalidasi Kartu &amp; Saldo...</p>
              <p className="text-[10px] text-slate-400">Menghubungi gateway ledger BNI</p>
            </div>
          )}

          {/* 5. SUCCESS (Green Panel with Student Details) */}
          {state.status === "success" && state.student && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-extrabold text-xs">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Pembayaran Berhasil!</span>
              </div>

              <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100 text-left space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Siswa:</span>
                  <span className="font-bold text-slate-900">{state.student.studentName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Sisa Saldo:</span>
                  <span className="font-extrabold text-emerald-700 font-mono">
                    {formatRupiah(state.student.balance)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Sisa Pagu Hari Ini:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {formatRupiah(Math.max(0, state.student.dailyLimit - state.student.dailySpent))}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-emerald-600 font-medium">
                Reset otomatis ke kasir baru dalam 3 detik...
              </p>
            </div>
          )}

          {/* 6. ERROR: INSUFFICIENT BALANCE (Red Alert + Retry) */}
          {state.status === "error_insufficient_balance" && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-center space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-rose-700 font-extrabold text-xs">
                <XCircle size={16} className="text-rose-600" />
                <span>Saldo Tidak Mencukupi</span>
              </div>

              <p className="text-[11px] text-rose-800 font-medium">
                Kurang nominal{" "}
                <span className="font-extrabold font-mono">
                  {formatRupiah(state.error?.amountShortfall ?? 0)}
                </span>
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "UNLOCK_ORDER" })}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Edit Pesanan
                </button>
                <button
                  type="button"
                  onClick={() => onCardTapped()}
                  className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white py-2 text-xs font-bold shadow-xs"
                >
                  Coba Tap Lagi
                </button>
              </div>
            </div>
          )}

          {/* 7. ERROR: DAILY LIMIT EXCEEDED (Amber Alert) */}
          {state.status === "error_daily_limit" && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-amber-800 font-extrabold text-xs">
                <AlertTriangle size={16} className="text-amber-600" />
                <span>Pagu Jajan Harian Tercapai</span>
              </div>

              <p className="text-[11px] text-amber-800">
                Sisa batas jajan hari ini:{" "}
                <span className="font-extrabold font-mono">
                  {formatRupiah(state.error?.dailyLimitRemaining ?? 0)}
                </span>
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "UNLOCK_ORDER" })}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Edit Pesanan
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "RESET_TO_IDLE" })}
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white py-2 text-xs font-bold shadow-xs"
                >
                  Selesai (Tunai)
                </button>
              </div>
            </div>
          )}

          {/* 8. ERROR: CARD BLOCKED (Red Alert) */}
          {state.status === "error_card_blocked" && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-center space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-rose-700 font-extrabold text-xs">
                <XCircle size={16} className="text-rose-600" />
                <span>Kartu Tidak Dapat Digunakan</span>
              </div>

              <p className="text-[11px] text-slate-600">
                {state.error?.message || "Kartu dilaporkan hilang atau diblokir. Hubungi admin sekolah."}
              </p>

              <button
                type="button"
                onClick={() => dispatch({ type: "RESET_TO_IDLE" })}
                className="w-full rounded-xl bg-slate-800 hover:bg-slate-900 text-white py-2 text-xs font-bold transition-colors"
              >
                Transaksi Baru
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
