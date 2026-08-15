import TelegramSettingsCard from "@/components/shared/TelegramSettingsCard";

export default function CanteenSettingsPage() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan POS Kantin</h1>
        <p className="text-sm text-muted-foreground">
          Konfigurasi notifikasi Telegram untuk transaksi penjualan dan ringkasan harian.
        </p>
      </div>
      <TelegramSettingsCard role="merchant" />
    </div>
  );
}
