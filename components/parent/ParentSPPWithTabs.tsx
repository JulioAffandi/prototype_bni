"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ParentSPPList from "@/components/parent/ParentSPPList";
import ParentCampaignInvoicesTab, { FormattedCampaignInvoice } from "@/components/parent/ParentCampaignInvoicesTab";
import { FileText, Megaphone } from "lucide-react";

interface ParentSPPWithTabsProps {
  sppInvoices: any[];
  campaignInvoices: FormattedCampaignInvoice[];
  parentWalletBalance: number;
}

export default function ParentSPPWithTabs({
  sppInvoices,
  campaignInvoices,
  parentWalletBalance,
}: ParentSPPWithTabsProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "kegiatan" ? "kegiatan" : "spp";
  const [activeTab, setActiveTab] = useState<"spp" | "kegiatan">(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "kegiatan") setActiveTab("kegiatan");
  }, [searchParams]);

  return (
    <div className="space-y-4">
      {/* Tab Controls */}
      <div className="flex items-center gap-2 p-1 bg-portal-surface rounded-2xl border border-portal-border shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("spp")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "spp"
              ? "bg-portal-primary text-white shadow-sm"
              : "text-portal-muted hover:text-portal-text"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>SPP Bulanan ({sppInvoices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("kegiatan")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "kegiatan"
              ? "bg-portal-primary text-white shadow-sm"
              : "text-portal-muted hover:text-portal-text"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Iuran Kegiatan ({campaignInvoices.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "spp" ? (
        <ParentSPPList initialInvoices={sppInvoices} />
      ) : (
        <ParentCampaignInvoicesTab
          invoices={campaignInvoices}
          parentWalletBalance={parentWalletBalance}
        />
      )}
    </div>
  );
}
