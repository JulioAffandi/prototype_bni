"use client";

import { useMemo, useState } from "react";
import { Plus, Minus, Trash2, ShoppingCart, CheckCircle2, X, UtensilsCrossed } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import NFCTriggerCard from "./NFCTriggerCard";

export interface PosMenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

interface CartItem extends PosMenuItem {
  qty: number;
}

interface PosTerminalClientProps {
  merchantId: string;
  menuItems: PosMenuItem[];
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const availableItems = useMemo(
    () => menuItems.filter((m) => m.available),
    [menuItems],
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
    [availableItems, selectedCategory],
  );

  function addToCart(item: PosMenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function updateQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.id !== itemId) return [c];
        const nextQty = c.qty + delta;
        return nextQty > 0 ? [{ ...c, qty: nextQty }] : [];
      }),
    );
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => prev.filter((c) => c.id !== itemId));
  }

  function clearCart() {
    setCart([]);
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

  // NFCTriggerCard posts the real transaction; this only handles the UI aftermath.
  const cartPayload = useMemo(
    () => cart.map((c) => ({ menu: c.name, qty: c.qty, price: c.price })),
    [cart],
  );

  function handleSuccess() {
    setSuccessMsg(`Transaksi ${formatRupiah(totalAmount)} berhasil diproses.`);
    setCart([]);
    setIsCartOpen(false);
    setTimeout(() => setSuccessMsg(null), 5000);
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-4 p-3 pb-28 sm:p-4 lg:grid-cols-12 lg:gap-6 lg:pb-6">
        {/* ══ LEFT: CATEGORY FILTER + PRODUCT CATALOG ══ */}
        <section className="space-y-4 lg:col-span-7 xl:col-span-8">
          {successMsg && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-700 shadow-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMsg}
            </div>
          )}

          {/* Category filter tabs */}
          <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                aria-pressed={selectedCategory === cat.id}
                className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                    : "border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Product cards grid */}
          {filteredMenu.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <UtensilsCrossed className="h-6 w-6 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">Belum ada menu tersedia</p>
              <p className="text-xs text-slate-400">
                Tambahkan item lewat menu Kelola Menu &amp; Stok.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filteredMenu.map((item) => {
                const inCart = cart.find((c) => c.id === item.id);
                return (
                  <button
                    key={item.id}
                    id={`menu-${item.id}`}
                    type="button"
                    onClick={() => addToCart(item)}
                    className={`group relative flex min-h-[110px] flex-col justify-between rounded-2xl border bg-white p-3.5 text-left shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98] ${
                      inCart
                        ? "border-orange-500 bg-orange-50/30 ring-2 ring-orange-500/20"
                        : "border-slate-200 hover:border-orange-300"
                    }`}
                  >
                    {inCart && (
                      <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white shadow">
                        {inCart.qty}
                      </span>
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {categoryLabel(item.category)}
                      </span>
                      <h3 className="mt-0.5 line-clamp-2 pr-6 text-xs font-bold text-slate-800 transition-colors group-hover:text-orange-600 sm:text-sm">
                        {item.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-extrabold text-orange-600 tabular-figures">
                        {formatRupiah(item.price)}
                      </span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                        <Plus size={14} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ══ MOBILE BACKDROP ══ */}
        {isCartOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setIsCartOpen(false)}
            aria-hidden
          />
        )}

        {/* ══ RIGHT: ACTIVE ORDER + NFC TAP TERMINAL ══
            Static sticky column on lg+, bottom-sheet drawer below lg. */}
        <aside
          className={`z-40 space-y-4 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[85dvh] max-lg:overflow-y-auto max-lg:rounded-t-3xl max-lg:border-t max-lg:border-slate-200 max-lg:bg-slate-50 max-lg:p-4 max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-300 lg:sticky lg:top-[4.5rem] lg:col-span-5 xl:col-span-4 ${
            isCartOpen ? "max-lg:translate-y-0" : "max-lg:translate-y-full"
          }`}
        >
          {/* Drawer grab handle (mobile only) */}
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="Tutup pesanan"
            className="mx-auto flex h-6 w-full items-center justify-center lg:hidden"
          >
            <span className="h-1 w-10 rounded-full bg-slate-300" />
          </button>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Cart header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingCart size={14} className="text-orange-500" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Ringkasan Pesanan
                </span>
                {totalQty > 0 && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                    {totalQty} item
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  id="clear-cart-btn"
                  onClick={clearCart}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors hover:text-red-500"
                >
                  <Trash2 size={13} /> Reset
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="max-h-56 space-y-2.5 divide-y divide-slate-100 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="space-y-1 py-8 text-center">
                  <p className="text-xs font-semibold text-slate-400">Keranjang masih kosong</p>
                  <p className="text-[11px] text-slate-400">
                    Pilih menu di katalog untuk membuat pesanan
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between pt-2.5 text-xs first:pt-0"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate font-bold text-slate-800">{item.name}</p>
                      <p className="text-[11px] font-medium text-slate-500 tabular-figures">
                        {formatRupiah(item.price)} × {item.qty}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="w-20 text-right font-extrabold text-slate-900 tabular-figures">
                        {formatRupiah(item.price * item.qty)}
                      </span>
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          id={`minus-${item.id}`}
                          onClick={() => updateQty(item.id, -1)}
                          aria-label={`Kurangi ${item.name}`}
                          className="px-1.5 py-1 text-slate-500 transition-colors hover:bg-slate-200"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="px-2 text-[11px] font-bold text-slate-800">{item.qty}</span>
                        <button
                          type="button"
                          id={`plus-${item.id}`}
                          onClick={() => updateQty(item.id, 1)}
                          aria-label={`Tambah ${item.name}`}
                          className="px-1.5 py-1 text-slate-500 transition-colors hover:bg-slate-200"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                      <button
                        type="button"
                        id={`remove-${item.id}`}
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Hapus ${item.name}`}
                        className="text-slate-300 transition-colors hover:text-red-500"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Billing summary + NFC tap zone */}
            <div className="space-y-3 border-t border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Subtotal</span>
                <span className="font-bold text-slate-700 tabular-figures">
                  {formatRupiah(totalAmount)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-dashed border-slate-200 pt-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Tagihan
                </span>
                <span className="text-xl font-extrabold text-slate-900 tabular-figures">
                  {formatRupiah(totalAmount)}
                </span>
              </div>

              <NFCTriggerCard
                variant="compact"
                merchantId={merchantId}
                totalAmount={totalAmount}
                items={cartPayload}
                onSuccess={handleSuccess}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* ══ MOBILE STICKY CART BAR ══ */}
      {!isCartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pr-20 shadow-[0_-4px_16px_-4px_rgba(15,23,42,0.1)] backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            disabled={cart.length === 0}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all ${
              cart.length === 0
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-orange-500 text-white shadow-md shadow-orange-500/25 active:scale-[0.99]"
            }`}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={16} />
              {cart.length === 0 ? "Keranjang kosong" : `Lihat Pesanan (${totalQty})`}
            </span>
            <span className="tabular-figures">{formatRupiah(totalAmount)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
