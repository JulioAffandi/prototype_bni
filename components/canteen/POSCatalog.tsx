"use client";

import { useState } from "react";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import NFCTriggerCard from "./NFCTriggerCard";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

interface CartItem extends MenuItem {
  qty: number;
}

interface POSCatalogProps {
  merchantId: string;
  menuItems: MenuItem[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function POSCatalog({ merchantId, menuItems }: POSCatalogProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === itemId);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter((c) => c.id !== itemId);
      return prev.map((c) =>
        c.id === itemId ? { ...c, qty: c.qty - 1 } : c,
      );
    });
  }

  function clearCart() {
    setCart([]);
  }

  function handleSuccess() {
    setSuccessMsg(`Transaksi ${formatRupiah(total)} berhasil!`);
    setCart([]);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  const cartItems = cart.map((c) => ({
    menu: c.name,
    qty: c.qty,
    price: c.price,
  }));

  const categories = Array.from(new Set(menuItems.map((m) => m.category)));

  return (
    <div className="p-4 space-y-4">
      {successMsg && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-medium">
          <ShoppingCart className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Menu catalog */}
      <div className="glass rounded-2xl p-4">
        <h2 className="font-semibold mb-3 text-sm">Menu Tersedia</h2>
        {categories.map((cat) => (
          <div key={cat} className="mb-4 last:mb-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
            <div className="grid grid-cols-2 gap-2">
              {menuItems
                .filter((m) => m.category === cat && m.available)
                .map((item) => {
                  const inCart = cart.find((c) => c.id === item.id);
                  return (
                    <button
                      key={item.id}
                      id={`menu-${item.id}`}
                      onClick={() => addToCart(item)}
                      className="relative p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left card-hover"
                    >
                      {inCart && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                          {inCart.qty}
                        </span>
                      )}
                      <p className="text-sm font-medium pr-6">{item.name}</p>
                      <p className="text-xs text-accent font-semibold mt-1">
                        {formatRupiah(item.price)}
                      </p>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Pesanan ({cart.length} item)</h2>
            </div>
            <button
              id="clear-cart-btn"
              onClick={clearCart}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Semua
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <p className="text-sm flex-1">{item.name}</p>
                <div className="flex items-center gap-2">
                  <button
                    id={`minus-${item.id}`}
                    onClick={() => removeFromCart(item.id)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                  <button
                    id={`plus-${item.id}`}
                    onClick={() => addToCart(item)}
                    className="w-6 h-6 rounded-full border border-primary/50 flex items-center justify-center hover:bg-primary/10 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-primary" />
                  </button>
                  <p className="text-sm font-semibold w-20 text-right">
                    {formatRupiah(item.price * item.qty)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{formatRupiah(total)}</span>
          </div>
        </div>
      )}

      {/* NFC Trigger */}
      <NFCTriggerCard
        merchantId={merchantId}
        totalAmount={total}
        items={cartItems}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
