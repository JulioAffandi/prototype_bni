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
    <div className="space-y-5">
      {/* Tab Controls */}
      <div className="flex items-center gap-2 border-b border-portal-border pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("spp")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "spp"
              ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
              : "bg-portal-surface-alt text-portal-muted hover:text-portal-text border border-portal-border"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>SPP Bulanan ({sppInvoices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("kegiatan")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "kegiatan"
              ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
              : "bg-portal-surface-alt text-portal-muted hover:text-portal-text border border-portal-border"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Iuran &amp; Kegiatan Sekolah ({campaignInvoices.length})</span>
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
