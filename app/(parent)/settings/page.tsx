import TelegramSettingsCard from "@/components/shared/TelegramSettingsCard";

export default function ParentSettingsPage() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Akun</h1>
        <p className="text-sm text-muted-foreground">
          Kelola preferensi akun dan notifikasi Telegram Anda.
        </p>
      </div>
      <TelegramSettingsCard role="parent" />
    </div>
  );
}
