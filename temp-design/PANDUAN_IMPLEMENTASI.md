# Panduan Implementasi — VALO BNI Role-Based Design System

## 1. Cara kerja token-nya

Satu set class semantik (`bg-portal-*`, `text-portal-*`, `border-portal-*`,
`rounded-portal`) dipetakan ke CSS variable `--portal-*`. Variable itu
di-*scope* lewat `data-portal="parent" | "school" | "canteen"` yang sudah
dipasang di masing-masing `layout.tsx`.

**Konsekuensi praktis:** komponen shared (Button, Card, Badge, Input, dll di
`components/ui/`) **tidak perlu tahu** portal mana yang sedang aktif. Cukup
pakai class semantik, dan tampilannya otomatis berubah sesuai portal induk.

```tsx
// Sama persis — hasil beda, tergantung ada di dalam data-portal apa
<button className="rounded-portal bg-portal-primary px-4 py-2 text-portal-primary-foreground">
  Simpan
</button>
```

## 2. Copy file ke proyek

| File di sini | Tujuan di proyek |
|---|---|
| `tailwind.config.ts` | root proyek (replace) |
| `globals.css` | `app/globals.css` (replace / merge) |
| `app/(parent)/layout.tsx` + `_components/BottomDock.tsx` | `app/(parent)/` |
| `app/(school)/layout.tsx` + `_components/Sidebar.tsx` | `app/(school)/` |
| `app/(canteen)/layout.tsx` + `_components/TopBar.tsx` | `app/(canteen)/` |

> Jika `globals.css` kamu sudah punya token lain (mis. shadcn/ui `--background`,
> `--foreground`), **jangan overwrite** — cukup tempel blok `[data-portal="..."]`
> di bawah token existing kamu.

## 3. Migrasi komponen existing (before → after)

Cari hardcoded color class di komponen lama, ganti ke token portal:

```diff
- <div className="bg-slate-900 border border-slate-800 rounded-2xl">
+ <div className="bg-portal-surface border border-portal-border rounded-portal-lg">

- <span className="text-emerald-500">Lunas</span>
+ <span className="text-portal-success">Lunas</span>

- <p className="font-mono text-sm">{nisn}</p>
+ <p className="font-portal-mono text-sm tabular-figures">{nisn}</p>
```

Untuk **status ledger di School** (Paid/Pending/Dispute), jangan pakai warna
Tailwind default (`emerald-500` dsb) langsung — selalu lewat
`text-portal-success` / `text-portal-warning` / `text-portal-danger` supaya
konsisten dengan token audit-ready yang sudah didefinisikan.

## 4. Root layout (`app/layout.tsx`)

Pastikan root layout **tidak** memasang `data-portal` — biarkan masing-masing
route group `(parent)`, `(school)`, `(canteen)` yang menentukan lewat
layout-nya sendiri. Root layout cukup load font:

```tsx
import { Inter, Geist_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

## 5. Komponen spesifik-portal yang masih perlu kamu bangun

Yang disediakan di sini baru **shell navigasi** (BottomDock, Sidebar, TopBar).
Sesuai tabel anatomi UI di spec, komponen konten berikut masih perlu dibuat
menyusul, tapi tinggal pakai token yang sama:

- **Parent:** `VaultCard` (donut progress ring), `GoalCard`, `BalanceHero`
  dengan glow — pakai `shadow-portal-glow`.
- **School:** `DataTable` dense + sortable header, `SPPBarChart`, tombol
  "Export CSV" — pakai `font-portal-mono` + `tabular-figures` untuk kolom
  nominal/NISN.
- **Canteen:** `ItemGrid` dengan quick +/- increment, `NumericKeypad`,
  `CartColumn` (sticky kanan), tombol besar "TAP KARTU NFC" — pakai
  `min-h-tap-lg` dan class `.nfc-flash-success` saat tap berhasil.

## 6. Verifikasi wajib sebelum PR

```bash
npx tsc --noEmit
```

Harus **0 error**. Kalau muncul error `Cannot find module './_components/...'`,
pastikan folder `_components/` sudah ter-copy persis di dalam masing-masing
route group (bukan di root `app/`).

### Catatan kontras WCAG AAA

Beberapa kombinasi warna di spec (mis. teks `--portal-accent` #F15A24 di atas
`--portal-bg` School #0B0F19) perlu **dicek manual** — AAA menuntut rasio
7:1 untuk teks normal dan 4.5:1 untuk teks besar (≥18pt/24px atau bold ≥14pt).
Token di file ini sudah dipilih dekat ke ambang tersebut, tapi:

- Gunakan warna accent (`portal-accent`, `portal-warning`) untuk **elemen
  besar/bold** (badge, ikon, angka besar), bukan body text panjang.
- Body text & label selalu pakai `text-portal-text` / `text-portal-muted`
  di atas `bg-portal-surface`, bukan langsung di atas warna primary/accent.
- Rekomendasi tool: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
  — jalankan per pasangan warna sebelum sign-off desain.
