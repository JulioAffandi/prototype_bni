import TelegramSettingsCard from "@/components/shared/TelegramSettingsCard";

export default function SchoolSettingsPage() {
  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Sekolah</h1>
        <p className="text-sm text-muted-foreground">
          Konfigurasi saluran notifikasi Telegram untuk laporan batch rekonsiliasi SPP.
        </p>
      </div>
      <TelegramSettingsCard role="school" />
    </div>
  );
}
