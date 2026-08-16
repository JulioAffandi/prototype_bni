"use client";

import { useState } from "react";
import type { InstitutionAsset, AssetKind, AssetCondition } from "@/types/institution";
import { Boxes, Plus, Store, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

interface AssetInventoryTableProps {
  schoolId: string;
  initialAssets: InstitutionAsset[];
  merchants: Array<{ id: string; name: string }>;
}

export default function AssetInventoryTable({
  schoolId,
  initialAssets,
  merchants,
}: AssetInventoryTableProps) {
  const [activeKind, setActiveKind] = useState<AssetKind>("NON_WORKING");
  const [assets, setAssets] = useState<InstitutionAsset[]>(initialAssets);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [kind, setKind] = useState<AssetKind>("NON_WORKING");
  const [merchantId, setMerchantId] = useState<string>(merchants[0]?.id || "");
  const [assetName, setAssetName] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [category, setCategory] = useState("Elektronik");
  const [location, setLocation] = useState("Ruang Kelas");
  const [quantity, setQuantity] = useState<number>(1);
  const [condition, setCondition] = useState<AssetCondition>("BAIK");

  const filteredAssets = assets.filter((a) => a.kind === activeKind);

  const refreshAssets = async () => {
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/assets`);
      if (res.ok) {
        const json = await res.json();
        setAssets(json.assets ?? []);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    const payload = {
      kind,
      asset_name: assetName,
      asset_code: assetCode || undefined,
      category,
      location,
      quantity,
      condition,
      merchant_id: kind === "WORKING" ? merchantId : undefined,
    };

    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setToastMessage({ type: "success", text: "Aset berhasil ditambahkan ke inventaris." });
        setShowModal(false);
        refreshAssets();
      } else {
        const json = await res.json();
        setToastMessage({ type: "error", text: json.detail || "Gagal menambahkan aset." });
      }
    } catch {
      setToastMessage({ type: "error", text: "Kesalahan jaringan saat mencatat aset." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            toastMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kind Filter Tabs & Create Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass p-4 rounded-2xl">
        <div className="flex items-center gap-2 p-1 bg-portal-surface-alt rounded-xl border border-portal-border">
          <button
            type="button"
            onClick={() => setActiveKind("NON_WORKING")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeKind === "NON_WORKING"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "text-portal-muted hover:text-portal-text"
            }`}
          >
            Aset Non-Working Operasional ({assets.filter((a) => a.kind === "NON_WORKING").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveKind("WORKING")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeKind === "WORKING"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "text-portal-muted hover:text-portal-text"
            }`}
          >
            Aset Working Merchant Kantin ({assets.filter((a) => a.kind === "WORKING").length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 rounded-portal bg-portal-primary px-4 py-2 text-xs font-semibold text-portal-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Aset Inventaris</span>
        </button>
      </div>

      {/* Asset Table */}
      <div className="glass rounded-2xl overflow-hidden border border-portal-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-portal-surface-alt border-b border-portal-border text-portal-muted">
              <tr>
                <th className="p-3.5 font-semibold">Kode &amp; Nama Aset</th>
                <th className="p-3.5 font-semibold">Kategori &amp; Lokasi</th>
                {activeKind === "WORKING" && <th className="p-3.5 font-semibold">Assigned Merchant</th>}
                <th className="p-3.5 font-semibold text-center">Jumlah (Qty)</th>
                <th className="p-3.5 font-semibold text-center">Kondisi Aset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-portal-border/50 text-portal-text">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={activeKind === "WORKING" ? 5 : 4} className="p-6 text-center text-portal-muted">
                    Belum ada data aset untuk kategori {activeKind}.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((item) => (
                  <tr key={item.id} className="hover:bg-portal-surface-alt/40 transition-colors">
                    <td className="p-3.5">
                      <p className="font-semibold text-portal-text">{item.asset_name}</p>
                      <p className="text-[11px] font-mono text-portal-muted">{item.asset_code || "KODE-AUTO"}</p>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-portal-surface-alt text-[10px] font-semibold border border-portal-border">
                        {item.category}
                      </span>
                      <p className="text-[11px] text-portal-muted mt-1">{item.location || "-"}</p>
                    </td>
                    {activeKind === "WORKING" && (
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-portal-primary font-medium">
                          <Store className="w-3.5 h-3.5" />
                          <span>{item.merchants?.name || "Merchant Kantin"}</span>
                        </div>
                      </td>
                    )}
                    <td className="p-3.5 text-center font-bold text-portal-text">{item.quantity} Unit</td>
                    <td className="p-3.5 text-center">
                      {item.condition === "BAIK" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>BAIK</span>
                        </span>
                      ) : item.condition === "PERLU_PERBAIKAN" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          <span>PERLU PERBAIKAN</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                          <XCircle className="w-3 h-3" />
                          <span>RUSAK</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateAsset} className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-md w-full space-y-4 border border-portal-border shadow-2xl">
            <div className="flex items-start justify-between border-b border-portal-border pb-3">
              <h3 className="text-base font-bold">Catat Aset Baru</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-portal-muted font-medium">Tipe Aset:</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AssetKind)}
                  className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                >
                  <option value="NON_WORKING">NON_WORKING (Fasilitas Operasional Sekolah)</option>
                  <option value="WORKING">WORKING (Commercial Asset Kantin/Merchant)</option>
                </select>
              </div>

              {kind === "WORKING" && (
                <div>
                  <label className="text-portal-muted font-medium">Assigned Merchant Kantin:</label>
                  <select
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                  >
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-portal-muted font-medium">Nama Perangkat / Barang:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EDC Android BNI / Proyektor Epson"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-portal-muted font-medium">Kategori:</label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                  />
                </div>
                <div>
                  <label className="text-portal-muted font-medium">Lokasi Penempatan:</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-portal-muted font-medium">Jumlah Unit:</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                  />
                </div>
                <div>
                  <label className="text-portal-muted font-medium">Kondisi Aset:</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as AssetCondition)}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                  >
                    <option value="BAIK">BAIK</option>
                    <option value="PERLU_PERBAIKAN">PERLU PERBAIKAN</option>
                    <option value="RUSAK">RUSAK</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-portal-border">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-portal border border-portal-border text-xs font-semibold text-portal-muted hover:text-portal-text"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={processing}
                className="px-4 py-2 rounded-portal bg-portal-primary text-portal-primary-foreground text-xs font-semibold hover:opacity-90"
              >
                {processing ? "Menyimpan..." : "Simpan Aset"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
