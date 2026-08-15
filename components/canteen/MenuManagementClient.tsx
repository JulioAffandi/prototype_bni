"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Utensils,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  TrendingUp,
} from "lucide-react";

export interface MenuItem {
  id: string;
  merchant_id: string;
  name: string;
  category: string;
  unit_price: number;
  unit_cost: number;
  stock_qty: number;
  is_active: boolean;
}

interface MenuManagementClientProps {
  merchantId: string;
  initialItems: MenuItem[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function MenuManagementClient({
  merchantId,
  initialItems,
}: MenuManagementClientProps) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [modalItem, setModalItem] = useState<MenuItem | null>(null); // null = add, object = edit
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Makanan Berat");
  const [unitPrice, setUnitPrice] = useState(12000);
  const [unitCost, setUnitCost] = useState(8000);
  const [stockQty, setStockQty] = useState(50);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = Array.from(new Set(["Makanan Berat", "Lauk", "Minuman", "Camilan", ...items.map((i) => i.category)]));

  const filtered = items.filter((item) => {
    const matchSearch = search === "" || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchSearch && matchCat;
  });

  function openAddModal() {
    setModalItem(null);
    setName("");
    setCategory("Makanan Berat");
    setUnitPrice(15000);
    setUnitCost(9000);
    setStockQty(50);
    setIsActive(true);
    setError(null);
    setShowModal(true);
  }

  function openEditModal(item: MenuItem) {
    setModalItem(item);
    setName(item.name);
    setCategory(item.category);
    setUnitPrice(item.unit_price);
    setUnitCost(item.unit_cost);
    setStockQty(item.stock_qty);
    setIsActive(item.is_active);
    setError(null);
    setShowModal(true);
  }

  async function handleToggleActive(item: MenuItem) {
    const newActive = !item.is_active;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_active: newActive } : i))
    );

    try {
      await fetch(`/api/v1/merchants/${merchantId}/menu`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_active: newActive }),
      });
    } catch (err) {
      console.error("Failed to toggle menu status", err);
    }
  }

  async function handleDelete(item: MenuItem) {
    if (!confirm(`Hapus menu "${item.name}"?`)) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    try {
      await fetch(`/api/v1/merchants/${merchantId}/menu?item_id=${item.id}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete menu item", err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (modalItem) {
        // Edit mode
        const res = await fetch(`/api/v1/merchants/${merchantId}/menu`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: modalItem.id,
            name: name.trim(),
            category: category.trim(),
            unit_price: Number(unitPrice),
            unit_cost: Number(unitCost),
            stock_qty: Number(stockQty),
            is_active: isActive,
          }),
        });

        const data = await res.json() as { item?: MenuItem; message?: string; error?: string };

        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Gagal mengedit menu");
        }

        setItems((prev) =>
          prev.map((i) => (i.id === modalItem.id ? { ...i, ...data.item } : i))
        );
      } else {
        // Add mode
        const res = await fetch(`/api/v1/merchants/${merchantId}/menu`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            category: category.trim(),
            unit_price: Number(unitPrice),
            unit_cost: Number(unitCost),
            stock_qty: Number(stockQty),
            is_active: isActive,
          }),
        });

        const data = await res.json() as { item?: MenuItem; message?: string; error?: string };

        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Gagal menambahkan menu");
        }

        setItems((prev) => [data.item!, ...prev]);
      }

      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Menu</p>
          <p className="text-xl font-bold mt-0.5">{items.length} item</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground">Menu Aktif</p>
          <p className="text-xl font-bold text-primary mt-0.5">
            {items.filter((i) => i.is_active).length} item
          </p>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground">Rata-rata Margin</p>
          <p className="text-xl font-bold text-accent mt-0.5 flex items-center justify-center gap-1">
            <TrendingUp className="w-4 h-4" />
            {items.length > 0
              ? `${Math.round(
                  items.reduce(
                    (sum, i) =>
                      sum +
                      ((i.unit_price - i.unit_cost) / Math.max(1, i.unit_price)) *
                        100,
                    0,
                  ) / items.length,
                )}%`
              : "0%"}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama menu..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
        >
          <option value="ALL" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">Semua Kategori</option>
          {categories.map((cat) => (
            <option key={cat} value={cat} className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">
              {cat}
            </option>
          ))}
        </select>

        <button
          id="add-menu-btn"
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Menu
        </button>
      </div>

      {/* Menu Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Nama Menu</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Kategori</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Harga Jual</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">HPP (Cost)</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Margin</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Stok</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Status</th>
              <th className="text-right p-4 text-xs text-muted-foreground font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const margin = Math.round(
                ((item.unit_price - item.unit_cost) / Math.max(1, item.unit_price)) * 100,
              );
              return (
                <tr
                  key={item.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="p-4 font-semibold">{item.name}</td>
                  <td className="p-4">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border font-medium">
                      {item.category}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-primary">{formatRupiah(item.unit_price)}</td>
                  <td className="p-4 text-muted-foreground text-xs">{formatRupiah(item.unit_cost)}</td>
                  <td className="p-4">
                    <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      +{margin}%
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs">{item.stock_qty} porsi</td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        item.is_active ? "badge-paid" : "badge-offline"
                      }`}
                    >
                      {item.is_active ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-primary" /> Aktif
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-muted-foreground" /> Nonaktif
                        </>
                      )}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all"
                        title="Edit Menu"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-all"
                        title="Hapus Menu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                  Belum ada menu yang sesuai dengan filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">
                  {modalItem ? "Edit Menu Kantin" : "Tambah Menu Kantin Baru"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nama Makanan / Minuman</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Nasi Goreng Spesial"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                  <option value="Makanan Berat" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">Makanan Berat</option>
                  <option value="Lauk" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">Lauk Pauk</option>
                  <option value="Minuman" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">Minuman</option>
                  <option value="Camilan" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">Camilan / Snack</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    step={1000}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">HPP / Modal (Rp)</label>
                  <input
                    type="number"
                    step={1000}
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Stok Porsi</label>
                  <input
                    type="number"
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Status Ketersediaan</label>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-full py-2 rounded-xl text-xs font-bold border transition-all ${
                      isActive
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {isActive ? "Tersedia (Aktif)" : "Habis / Nonaktif"}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-2 rounded-xl">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-all"
                >
                  Batal
                </button>
                <button
                  id="submit-menu-modal-btn"
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1 shadow-md disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    "Simpan Menu"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
