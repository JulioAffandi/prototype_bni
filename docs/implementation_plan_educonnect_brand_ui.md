# Implementation Plan — EduConnect Brand & UI Overhaul (Portal Orang Tua)

**Status:** Draft v1.0
**Scope:** Rebrand penuh (logo, warna, tipografi) + rebuild 12 layar mobile Portal Orang Tua
**Referensi:** Brand Guidelines (Gambar 2) · 12-Screen Mobile Flow (Gambar 1)
**Codebase saat ini:** Next.js 15 (App Router) · Tailwind v4 (CSS-var driven, `data-portal` scoping) · Supabase · shadcn-style components

---

## 0. Ringkasan Temuan Audit Codebase

Sebelum eksekusi, berikut kondisi eksisting yang jadi dasar keputusan teknis di bawah:

| Area | Kondisi Saat Ini | Gap terhadap Brand Guideline |
|---|---|---|
| `app/globals.css` | Tema global dark (`--background: 222 47% 5%`), token `--valo-*` (teal/orange), scoping `[data-portal="parent"]` pakai **teal `#0d9488`** dark navy | Perlu tema **light** (`#F8FAFC`) + **Purple `#7357C7` / Orange `#F97316`** |
| `tailwind.config.ts` | Sudah punya sistem token role-based (`portal-*` → resolve ke CSS var `--portal-*`) — **arsitektur ini bagus & tetap dipertahankan**, tinggal ganti nilai variabelnya | Tidak perlu rombak struktur config, cukup redefinisi value token di scope `[data-portal="parent"]` |
| Font | `font-family: "Inter"` hardcoded di `body` | Ganti ke **Plus Jakarta Sans** via `next/font/google` |
| Komponen Parent (`ParentDashboardClient.tsx`, `PaguManagementClient.tsx`, dll) | Styling **hardcoded Tailwind kelas dark** (`bg-slate-900`, `text-emerald-400`, `border-slate-800`) — **tidak** memakai token `portal-*` yang sudah tersedia di config | Refactor total: ganti semua hardcoded slate/emerald classes → token semantik `bg-portal-surface`, `text-portal-primary`, dst, supaya otomatis ikut tema baru |
| Logo | Belum ada komponen logo — hanya teks/icon lucide (`Wallet`, `Bot`) | Buat `EduConnectLogo.tsx` sesuai konsep infinity loop C+C+dot |
| Layar mobile | Baru ada ±4 dari 12 layar (Dashboard, Pagu, SPP, sebagian Riwayat via tabs) | Bangun 8 layar baru + restyle 4 layar existing |
| `formatRupiah` | Sudah ada di `lib/format.ts`, dipakai konsisten | Reuse — tidak perlu diubah |
| `AiAssistant.tsx` | Warna hardcoded `emerald-600`, `slate-900` | Restyle ke token portal (primary purple) |
| Bottom Nav | `BottomDock` (file belum terlihat isinya, direferensikan di `layout.tsx`) | Perlu dibuat/direstyle jadi 5 menu: Beranda · Pagu · SPP · Notifikasi · Profil |

**Keputusan arsitektur kunci:** Karena `tailwind.config.ts` sudah membangun sistem token `bg-portal-primary`, `text-portal-muted`, dll yang me-resolve ke CSS variable per-scope `data-portal`, overhaul brand ini **tidak mengubah struktur token**, hanya:
1. Mengganti *nilai* variabel `--portal-*` di dalam `[data-portal="parent"]` (dari dark-teal → light-purple/orange).
2. Refactor komponen yang saat ini melanggar sistem token (pakai `slate-*`/`emerald-*` hardcoded) agar konsisten pakai `portal-*`.

Ini meminimalkan risiko regresi ke portal `school` dan `canteen` yang **tidak** termasuk scope task ini dan **tidak boleh terpengaruh**.

---

## 1. Design System & Theme Mapping

### 1.1 Tipografi — Plus Jakarta Sans

**File baru:** `lib/fonts.ts`
```ts
import { Plus_Jakarta_Sans } from "next/font/google";

export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});
```

**Modifikasi:** `app/(parent)/layout.tsx` (root, bukan sub-layout) — daftarkan variable font di `<html>` atau `<body>` root layout Next.js, lalu override `--portal-font-sans` khusus scope parent:
```css
[data-portal="parent"] {
  --portal-font-sans: var(--font-plus-jakarta-sans), ui-sans-serif, system-ui, sans-serif;
}
```
> Catatan: Jika `school`/`canteen` portal tetap pakai Inter, load font Plus Jakarta Sans hanya di root layout parent group `app/(parent)/layout.tsx`, bukan `app/layout.tsx` global — agar bundle size portal lain tidak ikut membengkak.

### 1.2 Palet Warna — Redefinisi Token `[data-portal="parent"]`

Ganti blok berikut di `app/globals.css` (baris `[data-portal="parent"] { ... }`):

```css
[data-portal="parent"] {
  /* Surface — Light Theme */
  --portal-bg: #F8FAFC;
  --portal-surface: #FFFFFF;
  --portal-surface-alt: #F1F5F9;
  --portal-border: #E2E8F0;

  /* Brand */
  --portal-primary: #7357C7;           /* Primary Purple */
  --portal-primary-foreground: #FFFFFF;
  --portal-secondary: #C6E63A;         /* Lime Green — status/progress accents */
  --portal-accent: #F97316;            /* Accent Orange — CTA sekunder, warning limit */

  --portal-success: #10B981;           /* Emerald */
  --portal-warning: #F97316;
  --portal-danger: #EF4444;

  --portal-text: #111827;              /* Navy / Dark Text */
  --portal-text-muted: #64748B;

  --portal-font-sans: var(--font-plus-jakarta-sans), ui-sans-serif, system-ui, sans-serif;
  --portal-font-mono: var(--font-geist-mono, ui-monospace, monospace);

  --portal-radius: 1.25rem;            /* rounded-3xl feel — fintech modern */
  --portal-radius-lg: 1.75rem;
  --portal-glow: 0 8px 24px -6px rgba(115, 87, 199, 0.25);

  /* Token tambahan khusus brand EduConnect */
  --portal-gradient-primary: linear-gradient(135deg, #7357C7 0%, #F97316 100%);
  --portal-card-shadow: 0 4px 16px -4px rgba(17, 24, 39, 0.06);
}
```

**Tidak perlu** menambah entry baru ke `tailwind.config.ts` `colors.portal` karena sistem `var(--portal-*)` sudah generik. **Tambahan** yang diperlukan di `tailwind.config.ts`:
```ts
// theme.extend
backgroundImage: {
  "portal-gradient": "var(--portal-gradient-primary)",
},
boxShadow: {
  "portal-glow": "var(--portal-glow)",
  "portal-card": "var(--portal-card-shadow)",
},
```

Utility gradient text lime/orange (untuk elemen dekoratif seperti di `.gradient-text`) — tambahkan varian baru di `globals.css`:
```css
.gradient-text-brand {
  background: var(--portal-gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 1.3 Komponen Vektor Logo

**File baru:** `components/shared/EduConnectLogo.tsx`

```tsx
type LogoVariant = "full" | "icon" | "white";
interface EduConnectLogoProps {
  variant?: LogoVariant;
  className?: string;
  showTagline?: boolean;
}

export default function EduConnectLogo({
  variant = "full",
  className,
  showTagline = false,
}: EduConnectLogoProps) {
  const isWhite = variant === "white";
  const purple = isWhite ? "#FFFFFF" : "#7357C7";
  const orange = isWhite ? "#FFFFFF" : "#F97316";
  const dot = isWhite ? "#FFFFFF" : "#C6E63A";

  const icon = (
    <svg viewBox="0 0 64 40" className={variant === "icon" ? className : "h-8 w-auto"} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Infinity loop: C ungu (kiri) + C oranye (kanan), aksen titik pertumbuhan */}
      <path d="M20 8C11 8 4 15 4 22c0 5 4 9 9 9 6 0 9-4 13-9" stroke={purple} strokeWidth="7" strokeLinecap="round" />
      <path d="M44 8c9 0 16 7 16 14 0 5-4 9-9 9-6 0-9-4-13-9" stroke={orange} strokeWidth="7" strokeLinecap="round" />
      <circle cx="34" cy="6" r="4.5" fill={dot} />
    </svg>
  );

  if (variant === "icon") return icon;

  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      {icon}
      <div className="leading-tight">
        <p className={`text-lg font-bold ${isWhite ? "text-white" : "text-[#111827]"}`}>EduConnect</p>
        {showTagline && (
          <p className={`text-[10px] font-medium ${isWhite ? "text-white/80" : "text-[#64748B]"}`}>
            Connect • Learn • Grow
          </p>
        )}
      </div>
    </div>
  );
}
```

Dipakai di: header Layar 1 (Beranda), splash/login screen, `EduConnectLogo variant="white"` pada mockup Kartu NFC (Layar 5), dan header AI Assistant drawer.

---

## 2. Komponen UI Baru & Perubahan File

### 2.1 Struktur Direktori yang Ditargetkan

```
components/
  shared/
    EduConnectLogo.tsx              [BARU]
    GradientBalanceCard.tsx         [BARU] — kartu saldo/NFC gradient reusable
    QuickActionGrid.tsx             [BARU]
    BottomBar5Menu.tsx              [MODIFIKASI dari BottomDock, rename opsional]
  parent/
    ParentDashboardClient.tsx       [REFACTOR TOTAL — Layar 1]
    WeeklySummaryChart.tsx          [BARU] — Recharts bar chart (Layar 1)
    RecentActivityCard.tsx          [BARU] (Layar 1)
    TransactionHistoryClient.tsx    [BARU — Layar 2]
    TopUpClient.tsx                 [BARU — Layar 3]
    ParentSPPWithTabs.tsx           [REFACTOR — Layar 4] (existing, cek file terpisah)
    ParentCampaignInvoicesTab.tsx   [REFACTOR TOTAL — styling ke light theme]
    NfcCardClient.tsx               [BARU — Layar 5]
    ChildProfileClient.tsx          [BARU — Layar 6]
    PaguManagementClient.tsx        [REFACTOR TOTAL — Layar 7]
    NotificationCenterClient.tsx    [BARU — Layar 8]
    CardUsageHistoryClient.tsx      [BARU — Layar 9]
    TopUpSuccessClient.tsx          [BARU — Layar 10]
    SppPaymentSuccessModal.tsx      [BARU — Layar 11]
    ReportLostCardWizard.tsx        [BARU — Layar 12]
  chat/
    AiAssistant.tsx                 [REFACTOR — restyle token portal]
```

### 2.2 Pemetaan Layar → File → Route

| # | Layar | Route (`app/(parent)/...`) | Server Page | Client Component |
|---|---|---|---|---|
| 1 | Beranda | `/dashboard` (existing) | `page.tsx` (existing, minor query tambahan utk weekly summary) | `ParentDashboardClient.tsx` (refactor) |
| 2 | Riwayat Transaksi | `/riwayat` **[BARU]** | `page.tsx` baru — fetch `canteen_transactions` + `wallet_topups` + `spp_invoices` gabungan, grouped by bulan | `TransactionHistoryClient.tsx` |
| 3 | Top Up Saldo | `/topup` **[BARU]** | `page.tsx` baru — fetch saldo anak aktif | `TopUpClient.tsx` |
| 4 | SPP & Tagihan | `/spp` (existing) | `page.tsx` (existing, sudah oke) | `ParentSPPWithTabs.tsx` (restyle), `ParentCampaignInvoicesTab.tsx` (restyle) |
| 5 | Kartu NFC | `/kartu` **[BARU]** (split dari `/pagu`) | `page.tsx` baru — fetch `student_cards` | `NfcCardClient.tsx` |
| 6 | Profil Anak | `/profil-anak/[studentId]` **[BARU]** | `page.tsx` baru — fetch `students` + `guardian_student_map` | `ChildProfileClient.tsx` |
| 7 | Atur Pagu | `/pagu` (existing) | `page.tsx` (existing) | `PaguManagementClient.tsx` (refactor — pisahkan bagian NFC ke Layar 5) |
| 8 | Notifikasi | `/notifikasi` **[BARU]** | `page.tsx` baru — fetch tabel `notifications` | `NotificationCenterClient.tsx` |
| 9 | Riwayat Kartu | `/kartu/riwayat` **[BARU]** | `page.tsx` baru — fetch `canteen_transactions` per jam | `CardUsageHistoryClient.tsx` |
| 10 | Konfirmasi Top Up | Modal/route `/topup/sukses` **[BARU]** (state-driven, bukan full page) | — | `TopUpSuccessClient.tsx` (dirender setelah `TopUpClient` submit sukses) |
| 11 | Pembayaran SPP Berhasil | Modal (sudah ada pola di `ParentCampaignInvoicesTab.tsx` — `selectedReceipt`) | — | `SppPaymentSuccessModal.tsx` (extract & restyle dari modal existing) |
| 12 | Laporkan Kartu Hilang | `/kartu/lapor-hilang` **[BARU]** | `page.tsx` baru | `ReportLostCardWizard.tsx` (3-step form state machine) |

### 2.3 Perubahan File Inti (Theming & Layout)

| File | Perubahan |
|---|---|
| `app/globals.css` | Redefinisi blok `[data-portal="parent"]` (lihat §1.2); **tidak menyentuh** blok `school`/`canteen` |
| `tailwind.config.ts` | Tambah `backgroundImage.portal-gradient`, `boxShadow.portal-card` (lihat §1.2) |
| `lib/fonts.ts` | **BARU** — export `plusJakartaSans` |
| `app/(parent)/layout.tsx` | Import font, apply `className={plusJakartaSans.variable}` pada wrapper; ganti radial glow dari teal → `var(--portal-gradient-primary)` opacity rendah; ganti `BottomDock` → `BottomBar5Menu` (5 menu: Beranda, Pagu, SPP, Notifikasi, Profil sesuai Gambar 1, bukan 4 menu lama) |
| `components/shared/BottomBar5Menu.tsx` | Refactor dari `BottomDock` — 5 item, active state pakai `bg-portal-primary/10 text-portal-primary`, ikon lucide (`Home`, `Wallet`, `FileText`, `Bell`, `User`) |
| `components/chat/AiAssistant.tsx` | Ganti semua `emerald-600`/`slate-900` → `bg-portal-primary`, `bg-portal-surface`, `border-portal-border`; trigger button pakai `EduConnectLogo variant="icon"` alih-alih ikon `Bot` generik (opsional, pertahankan `Bot` jika ingin netral) |

---

## 3. Penyelarasan Data Supabase

**Prinsip:** Overhaul ini murni **presentation layer**. Semua query Supabase existing di server components (`page.tsx`) dipertahankan strukturnya; hanya **tambahan query baru** untuk layar yang belum ada, dan **tidak ada breaking change** ke skema tabel.

### 3.1 Mapping Data Dinamis per Layar

| Layar | Sumber Data Supabase | Field Kunci | Status |
|---|---|---|---|
| 1. Beranda | `parents`, `students`, `student_vault`, `canteen_transactions` | `wallet_balance`, `daily_limit`, `daily_limit_used` | Sudah ada (`page.tsx` dashboard) |
| 1. Widget Ringkasan Mingguan | `canteen_transactions` **[QUERY BARU]** | Agregasi `SUM(amount) GROUP BY DATE(created_at)` 7 hari terakhir, difilter `student_id` | Tambahkan di `page.tsx` dashboard: query rentang tanggal Senin–Minggu, kirim sbg prop `weeklySummary` ke `WeeklySummaryChart` |
| 2. Riwayat Transaksi | `canteen_transactions` + `wallet_topups` (atau tabel setara) + `spp_invoices` | union 3 sumber, sort by `created_at` desc, group by bulan | Query baru — pertimbangkan Postgres `UNION ALL` via RPC/view `v_parent_transaction_history` agar tidak 3x round-trip |
| 3. Top Up | `parents.wallet_balance`, insert ke `wallet_topups` (status PENDING → VA generation) | Perlu endpoint API `/api/v1/parents/topup` (cek apakah sudah ada, jika belum → buat) | **Perlu klarifikasi backend**: apakah BNI VA generation sudah ada endpoint-nya |
| 4. SPP | `spp_invoices`, `campaign_invoices` | Sudah ada, lihat `page.tsx` (`app/(parent)/spp/page.tsx`) | Reuse existing |
| 5. Kartu NFC | `student_cards` | `card_uid_last4`, `status`, `is_active` | Sudah ada di query dashboard/pagu — pindahkan ke route `/kartu` |
| 6. Profil Anak | `students`, `guardian_student_map` join `parents` | Perlu join eksplisit ke tabel `parents` untuk daftar "Ayah/Ibu Terverifikasi" — cek FK `guardian_student_map.parent_id` | Query baru |
| 7. Atur Pagu | `students.daily_limit`, `emergency_limit`, `emergency_approve` | Sudah ada (`PaguManagementClient.tsx` + endpoint `/api/v1/students/[id]/pagu`) | Reuse, hanya restyle |
| 8. Notifikasi | **Tabel `notifications` — perlu verifikasi keberadaan** | `type`, `title`, `body`, `is_read`, `created_at` | **Perlu klarifikasi**: apakah tabel ini sudah ada di skema; jika belum, tambahkan migration |
| 9. Riwayat Kartu | `canteen_transactions` filtered per `student_id`, join `merchants` | Sudah ada pola query-nya di dashboard (`recentTaps`) — tinggal extend tanpa limit 8 & tambah filter periode | Reuse pola existing |
| 10/11. Sukses Top Up/SPP | State dari response API (`bni_h2h_reference`, `receipt_qr_hash`) — **sudah ada polanya** di `ParentCampaignInvoicesTab.tsx` (`handlePayInvoice`) | — | Reuse pola, tinggal extract ke komponen shared |
| 12. Lapor Kartu Hilang | Update `student_cards.status = 'BLOCKED'`, insert log ke tabel audit (jika ada) | Endpoint `/api/v1/students/[id]/card/report-lost` **[PERLU DIBUAT jika belum ada]** | **Perlu klarifikasi backend** |

### 3.2 Item yang Memerlukan Konfirmasi Sebelum Eksekusi Fase 3 (lihat §4)

1. **Tabel `notifications`** — konfirmasi skema (atau usulkan migration baru) sebelum membangun Layar 8.
2. **Endpoint Top Up BNI VA** — konfirmasi apakah generation VA sudah tersedia di backend, atau perlu di-mock dulu untuk keperluan UI (dengan `TODO: integrate real BNI H2H` comment).
3. **Endpoint Report Lost Card** — sama seperti di atas.
4. Semua item di atas **tidak menghalangi** pengerjaan Fase 1–2 (theming & komponen shared), sehingga bisa dikerjakan paralel sambil menunggu konfirmasi.

---

## 4. Urutan Pengerjaan Bertahap (Phased Execution)

### Fase 0 — Persiapan & Verifikasi (0.5 hari)
- [ ] Konfirmasi 3 item data Supabase di §3.2 dengan tim backend.
- [ ] Cek file `BottomDock` (belum terlihat isinya) — view langsung dari repo sebelum refactor.
- [ ] Cek apakah `ParentSPPWithTabs.tsx` (dirujuk di route `/spp`) sudah tersedia — belum termasuk file yang di-upload, perlu diverifikasi isinya sebelum restyle.

### Fase 1 — Theme & Brand Foundation (1 hari)
- [ ] Setup `lib/fonts.ts` (Plus Jakarta Sans) + terapkan di `app/(parent)/layout.tsx`.
- [ ] Redefinisi token warna `[data-portal="parent"]` di `globals.css` (§1.2).
- [ ] Tambah `backgroundImage`/`boxShadow` baru di `tailwind.config.ts`.
- [ ] Build `components/shared/EduConnectLogo.tsx` (3 varian).
- [ ] Build `components/shared/GradientBalanceCard.tsx` (reusable untuk Layar 1 & 5, gradient `#7357C7 → #F97316`).
- [ ] QA visual: render 1 halaman existing (`/dashboard`) tanpa refactor komponen dulu — pastikan token baru ter-apply, tidak break portal `school`/`canteen`.

### Fase 2 — Layout & Navigasi Global (0.5 hari)
- [ ] Refactor `BottomDock` → `BottomBar5Menu` (5 menu sesuai Gambar 1).
- [ ] Update `app/(parent)/layout.tsx`: radial glow baru, integrasi `BottomBar5Menu`.
- [ ] Restyle `AiAssistant.tsx` ke token `portal-*`.

### Fase 3 — Pembuatan/Refactor 12 Layar (5–7 hari, urut prioritas alur pengguna)
Urutan dipilih berdasarkan ketergantungan navigasi (bottom-nav dulu, baru turunan):
1. [ ] **Layar 1 — Beranda**: refactor `ParentDashboardClient.tsx` total (hardcoded slate/emerald → token portal), tambah `WeeklySummaryChart.tsx` (Recharts), `QuickActionGrid.tsx`, `RecentActivityCard.tsx`.
2. [ ] **Layar 7 — Atur Pagu**: refactor `PaguManagementClient.tsx`, pisahkan bagian "Kartu NFC Management" menjadi entrypoint ke Layar 5.
3. [ ] **Layar 5 — Kartu NFC**: `NfcCardClient.tsx` baru + mockup kartu fisik pakai `GradientBalanceCard` variant kartu + `EduConnectLogo variant="white"`.
4. [ ] **Layar 12 — Lapor Kartu Hilang**: `ReportLostCardWizard.tsx` (3-step: Laporan → Verifikasi → Selesai), dipicu dari Layar 5.
5. [ ] **Layar 4 — SPP**: restyle `ParentSPPWithTabs.tsx` + `ParentCampaignInvoicesTab.tsx` (refactor total dari `portal-*` classes yang sudah lumayan konsisten — tinggal update value token, minim perubahan struktur JSX).
6. [ ] **Layar 11 — SPP Sukses**: extract modal kuitansi existing dari `ParentCampaignInvoicesTab.tsx` → `SppPaymentSuccessModal.tsx` shared, restyle QR & badge sesuai brand.
7. [ ] **Layar 3 — Top Up**: `TopUpClient.tsx` baru (preset nominal, VA BNI).
8. [ ] **Layar 10 — Konfirmasi Top Up**: `TopUpSuccessClient.tsx` (checkmark hijau besar, detail transaksi).
9. [ ] **Layar 2 — Riwayat Transaksi**: `TransactionHistoryClient.tsx` (tabs filter + grouping bulan) — butuh query gabungan §3.1.
10. [ ] **Layar 9 — Riwayat Penggunaan Kartu**: `CardUsageHistoryClient.tsx` (banner total + struk per jam).
11. [ ] **Layar 6 — Profil Anak**: `ChildProfileClient.tsx` (tab Info/Orang Tua/Pengaturan sesuai Gambar 1).
12. [ ] **Layar 8 — Notifikasi**: `NotificationCenterClient.tsx` (timeline Hari Ini/Sebelumnya) — bergantung konfirmasi skema tabel `notifications` (Fase 0).

### Fase 4 — Verifikasi TypeScript & Responsivitas Mobile (1 hari)
- [ ] `npm run build` / `tsc --noEmit` — pastikan 0 error di seluruh file baru & refactor.
- [ ] `npm run lint` — pastikan konsisten dengan `eslint-config-next`.
- [ ] QA manual di viewport mobile (375px–430px, sesuai mockup Gambar 1) untuk seluruh 12 layar: cek touch target ≥44px, contrast text vs background light theme, safe-area bottom nav.
- [ ] Regresi visual: pastikan portal `school` dan `canteen` (dark theme) **tidak berubah** — smoke test render `/school/*` dan `/canteen/*`.
- [ ] Cross-check semua nilai dinamis (saldo, NISN, SPP, pagu, notifikasi) di 12 layar benar-benar dari Supabase — **tidak ada data dummy/hardcoded** tersisa di komponen final (kecuali fallback yang sudah ada polanya, contoh: `|| "SMA BNI Harapan Bangsa"`).

### Fase 5 — Handoff
- [ ] Update `README.md` / Storybook (jika ada) dengan referensi token brand baru.
- [ ] Screenshot before/after 12 layar untuk dokumentasi PR.

---

## 5. Ringkasan Estimasi

| Fase | Estimasi |
|---|---|
| 0. Persiapan & Verifikasi | 0.5 hari |
| 1. Theme & Brand Foundation | 1 hari |
| 2. Layout & Navigasi Global | 0.5 hari |
| 3. 12 Layar (build/refactor) | 5–7 hari |
| 4. Verifikasi TS & Responsivitas | 1 hari |
| **Total** | **~8–10 hari kerja** |

**Risiko utama:** ketergantungan pada konfirmasi backend (tabel `notifications`, endpoint Top Up VA, endpoint report-lost-card) — direkomendasikan mulai Fase 0 di hari pertama secara paralel dengan Fase 1 agar tidak memblokir jalur kritis.
