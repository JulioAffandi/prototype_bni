# Implementation Plan: Executive Financial Redesign (EduConnect Style)

Target: `app/(school)/school/page.tsx` dan `components/school/Sidebar.tsx`
Referensi visual: `Prompt 16/1.png`
Basis kode terverifikasi: `package.json`, `supabase/schema_v3.sql`, `Prompt 16/20260816_institution_full_modules.sql`, `types/institution.ts`
Tanggal: 16 Agustus 2026

---

## 0. Ringkasan Eksekutif dan Batasan Kritis

Redesign ini layak dikerjakan tanpa menyentuh RPC akuntansi (`fn_post_journal`, `fn_execute_payroll_batch`, `fn_resolve_procurement`) karena seluruh widget bersifat baca saja. Namun terdapat empat blocker data yang harus diputuskan sebelum coding dimulai. Mengabaikannya akan menghasilkan dashboard yang secara visual identik dengan mockup tetapi menampilkan angka hardcoded, yang bertentangan langsung dengan syarat "mempertahankan data Supabase".

### Blocker 1: Tidak ada tabel budget

Widget "Budget vs Actual" menuntut anggaran per unit (Academic, Operations, HR and Payroll, IT, Facilities, Student Activities). Tidak ada tabel anggaran di `schema_v3.sql` maupun di migrasi `20260816_institution_full_modules.sql`. Konsekuensinya widget ini tidak punya sumber kebenaran. Opsi:

- Opsi A (direkomendasikan): tambah tabel baru `public.institution_budgets` beserta `institution_budget_unit_t` enum. Aditif, tidak mengubah tabel lama, tidak menyentuh trigger imutabilitas.
- Opsi B: turunkan "budget" dari rata rata realisasi 3 periode sebelumnya. Ini bukan anggaran, ini baseline. Harus dilabeli eksplisit sebagai baseline agar tidak menyesatkan juri atau auditor.
- Opsi C: hardcode. Ditolak, melanggar syarat tugas.

### Blocker 2: Kolom akun bank BCA tidak ada di model data

Tabel "Recent Financial Activity" pada mockup menampilkan kolom Account berisi `BCA 123-456-7890` dan `BNI 987-654-3210`. Skema hanya mengenal jalur BNI: `spp_invoices.bni_h2h_reference`, `institution_payroll.bni_account_number`, `institution_payroll.bni_account_name`. Tidak ada entitas bank multi provider. Rekomendasi: ganti kolom Account menjadi Reference yang menampilkan `bni_h2h_reference` atau `ledger_transactions.source` plus 4 digit terakhir rekening bila tersedia. Menampilkan BCA pada produk yang diposisikan sebagai integrasi BNI H2H juga merugikan secara naratif kompetisi.

### Blocker 3: Format angka pada mockup salah untuk lokal Indonesia

Mockup menulis `Rp 12.8B`, `Rp 486M`, `Rp 2.08B`. Notasi `B` untuk miliar adalah konvensi Inggris. Dalam bahasa Indonesia `M` berarti miliar dan `Jt` berarti juta, sehingga `Rp 486M` akan terbaca 486 miliar oleh pengguna Indonesia padahal mockup memaksudkan 486 juta. Ini defect fungsional, bukan preferensi. Rekomendasi: gunakan `Rp 12,8 M` dan `Rp 486 Jt` melalui satu helper terpusat `formatCompactIDR`.

### Blocker 4: Sparkline butuh deret waktu, bukan satu nilai

Lima KPI card di mockup masing masing punya sparkline. `ledger_accounts.balance` hanya menyimpan saldo terkini. Deret historis harus direkonstruksi dari `ledger_entries.balance_after` yang diurutkan dengan `entry_seq`. Untuk sekolah dengan volume transaksi kantin tinggi, menarik seluruh entry ke Node lalu mengagregasi di memori akan lambat. Agregasi wajib dilakukan di Postgres.

### Prinsip yang dipegang

1. Tidak ada perubahan pada tabel, trigger, constraint, atau RPC yang sudah ada.
2. Seluruh objek database baru bersifat aditif dan read only, kecuali tabel budget pada Opsi A.
3. `page.tsx` tetap Server Component. Seluruh interaktivitas didorong ke child client component.
4. Tidak ada penghapusan rute. Reorganisasi sidebar hanya mengubah presentasi navigasi.

---

## 1. Daftar Dependensi dan Konfigurasi Theme

### 1.1 Dependensi

Seluruh library yang diminta sudah terpasang. Tidak ada `npm install` yang diperlukan.

| Package | Versi terpasang | Status | Catatan integrasi |
|---|---|---|---|
| `recharts` | 3.10.1 | Ada | Wajib di dalam `"use client"`. `ResponsiveContainer` memerlukan parent dengan tinggi eksplisit, gunakan `h-[280px]` bukan `h-full`. |
| `framer-motion` | 13.1.0 | Ada | Wajib `"use client"`. Gunakan `LazyMotion` dengan `domAnimation` untuk menekan bundle. |
| `lucide-react` | 0.511.0 | Ada | Sudah dipakai di `page.tsx` dan `Sidebar.tsx`. |
| `next` | 15.3.8 | Ada | React 19, Server Components aktif. |

Tidak diperlukan `date-fns` atau `dayjs`. Seluruh formatting tanggal memakai `Intl.DateTimeFormat("id-ID")` yang sudah menjadi pola di `page.tsx` baris 165.

### 1.2 Konfigurasi Theme

Berkas `globals.css` tidak disertakan dalam folder Prompt 16, sehingga daftar token `portal-*` yang aktif tidak dapat diverifikasi. Yang terbaca dari kode adalah: `portal-border`, `portal-surface`, `portal-surface-alt`, `portal-primary`, `portal-primary-foreground`, `portal-text`, `portal-muted`, `portal-success`, `portal-danger`, `rounded-portal`, serta utility `glass`, `card-hover`, `progress-fill`, `badge-settled`, `badge-rejected`, `badge-offline`.

Strategi: tambah token baru, jangan timpa token lama. Sidebar dan portal lain (parent, merchant, canteen) kemungkinan berbagi token yang sama, sehingga mengubah nilai `--portal-primary` akan mengubah portal lain secara tidak sengaja.

Tambahkan pada `app/globals.css` di dalam blok `@theme` Tailwind v4:

```css
@theme {
  /* Royal Navy / Violet Indigo, scoped ke dashboard finansial sekolah */
  --color-fin-sidebar-from: oklch(0.42 0.19 285);   /* #4B3BC4 approx */
  --color-fin-sidebar-to:   oklch(0.36 0.17 285);   /* #3B2FA0 approx */
  --color-fin-primary:      oklch(0.55 0.22 285);   /* #5B4BDB, seri Inflow */
  --color-fin-primary-soft: oklch(0.55 0.22 285 / 12%);
  --color-fin-outflow:      oklch(0.70 0.19 45);    /* #F97316, seri Outflow */
  --color-fin-outflow-soft: oklch(0.70 0.19 45 / 12%);
  --color-fin-net:          oklch(0.75 0.19 130);   /* #84CC16, seri Net Cashflow */
  --color-fin-net-soft:     oklch(0.75 0.19 130 / 14%);
  --color-fin-critical:     oklch(0.58 0.22 25);
  --color-fin-attention:    oklch(0.75 0.17 75);
  --color-fin-info:         oklch(0.62 0.16 250);
  --color-fin-card:         oklch(1 0 0);
  --color-fin-card-border:  oklch(0.92 0.01 285);
  --radius-fin:             0.875rem;
}
```

Mapping token ke elemen visual:

| Elemen mockup | Token | Kelas Tailwind |
|---|---|---|
| Latar sidebar | `fin-sidebar-from` ke `fin-sidebar-to` | `bg-gradient-to-b from-fin-sidebar-from to-fin-sidebar-to` |
| Item nav aktif | putih 12 persen di atas gradient | `bg-white/12 text-white font-semibold` |
| Kartu KPI dan panel | `fin-card`, `fin-card-border` | `bg-fin-card border border-fin-card-border rounded-fin` |
| Seri Inflow, sparkline Cash Position | `fin-primary` | `stroke-fin-primary`, `fill-fin-primary-soft` |
| Seri Outflow | `fin-outflow` | `stroke-fin-outflow` |
| Seri Net Cashflow, progress bar collection | `fin-net` | `stroke-fin-net`, `bg-fin-net` |
| Badge Critical, Attention, Information | `fin-critical`, `fin-attention`, `fin-info` | varian di `AlertBadge` |

Catatan implementasi. Recharts tidak membaca kelas Tailwind pada prop `stroke` dan `fill` secara andal karena nilainya diteruskan ke atribut SVG. Definisikan konstanta warna di satu berkas `lib/school/chart-theme.ts` yang mengekspor nilai hex atau `var(--color-fin-primary)`, lalu gunakan konstanta itu di seluruh komponen chart. Ini mencegah drift warna antara kartu HTML dan seri chart.

Kontras aksesibilitas. Teks `text-white/70` di atas `fin-sidebar-to` perlu diuji terhadap WCAG AA 4.5:1. Label nav non aktif pada mockup terlihat sekitar 60 persen opasitas, yang berisiko gagal. Naikkan ke `text-white/80` minimal.

---

## 2. Breakdown Komponen Frontend

Seluruh berkas baru berada di bawah `components/school/dashboard/`. Tidak ada berkas lama yang dihapus.

### 2.1 Primitif bersama

| Berkas | Boundary | Tanggung jawab |
|---|---|---|
| `DashboardCard.tsx` | Server | Shell kartu: border, radius, padding, slot title, slot action "View All". Menghilangkan duplikasi kelas di 10 widget. |
| `Sparkline.tsx` | Client | Recharts `AreaChart` minimalis tanpa axis, grid, tooltip. Props: `data: number[]`, `stroke: string`, `fill?: string`, `height?: number` default 32. |
| `AnimatedNumber.tsx` | Client | `framer-motion` `useMotionValue` plus `animate` untuk counter. Props: `value: number`, `format: (n: number) => string`, `durationMs?: number` default 700. Wajib `prefers-reduced-motion` guard. |
| `TrendPill.tsx` | Server | Panah naik turun plus persentase plus label pembanding. Props: `deltaPct: number`, `comparisonLabel: string`, `invertPolarity?: boolean`. Flag `invertPolarity` diperlukan karena kenaikan Outflow dan Outstanding adalah sinyal negatif, sementara komponen default menghijaukan angka positif. |
| `StatusBadge.tsx` | Server | Badge untuk tabel aktivitas dan panel alert. Reuse mapping dari `badge-settled`, `badge-rejected`, `badge-offline` yang sudah ada. |

### 2.2 Widget utama

| Berkas | Boundary | Props masuk | Catatan risiko |
|---|---|---|---|
| `DashboardFilters.tsx` | Client | `schools: {id,name}[]`, `academicYears: string[]`, `defaultRange: {from,to}` | Filter harus menulis ke `searchParams` melalui `useRouter().replace`, bukan `useState` lokal, agar Server Component dapat memfetch ulang. Selector sekolah hanya boleh menampilkan sekolah yang ada di `user_roles` pengguna, jika tidak akan terjadi kebocoran lintas tenant di level UI. |
| `KPISparklineCard.tsx` | Client | `label`, `sublabel`, `icon`, `value: number`, `formatter`, `deltaPct`, `series: number[]`, `accent` | Satu komponen dipakai 5 kali. Jangan buat 5 komponen terpisah. |
| `KPIRow.tsx` | Server | `metrics: KpiMetric[]` | Grid `grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4`. Mockup memakai 5 kolom yang akan pecah di bawah 1280px. |
| `CashflowChart.tsx` | Client | `series: CashflowPoint[]` untuk keempat rentang | Toggle 7D, 30D, 3M, 12M. Keputusan penting: prefetch keempat rentang di server dalam satu RPC dan simpan di state klien, atau refetch per klik. Prefetch lebih baik karena 12M harian hanya 365 baris ringan dan menghilangkan spinner. |
| `TuitionCollectionWidget.tsx` | Server | `billing`, `collected`, `outstanding`, `overdue`, `ratePct` | Progress bar memakai `progress-fill` yang sudah ada. |
| `TuitionAgingWidget.tsx` | Server | `buckets: AgingBucket[]` | Lima bucket Current, 1-30, 31-60, 61-90, 90+. Persentase dihitung terhadap total outstanding, bukan terhadap total billing. Mockup menampilkan 14,5 + 27,5 + 24,4 + 18,3 + 15,3 = 100,0 yang mengonfirmasi denominator outstanding. |
| `FinancialAlertsPanel.tsx` | Server | `alerts: FinancialAlert[]` | Alert diturunkan dari rule engine di seksi 3.6, bukan dari tabel. |
| `PaymentForecastChart.tsx` | Client | `actual`, `expected`, `upcoming`, `confidence` | Lihat peringatan metodologi di seksi 3.5. |
| `BudgetUtilizationWidget.tsx` | Server | `rows: BudgetRow[]` | Utilisasi di atas 100 persen diberi warna `fin-outflow` plus ikon peringatan, sesuai baris Student Activities 112,0 persen pada mockup. |
| `QuickAIChatWidget.tsx` | Client | `presetQuestions: string[]` | Reuse `AIChatDrawer` dan endpoint `/api/v1/ai/treasury-advisor` yang sudah ada. Jangan buat endpoint kedua. Tombol pill hanya memanggil `onSubmit(question)` pada drawer yang sama. |
| `RecentActivityTable.tsx` | Server | `rows: ActivityRow[]` | Kolom Account diganti Reference, lihat Blocker 2. |

### 2.3 Berkas pendukung

| Berkas | Isi |
|---|---|
| `lib/school/dashboard-types.ts` | `KpiMetric`, `CashflowPoint`, `AgingBucket`, `FinancialAlert`, `BudgetRow`, `ActivityRow`, `ForecastPoint`. Tidak ada `any`. |
| `lib/school/dashboard-queries.ts` | Seluruh fungsi fetch. Satu fungsi per widget, semua menerima `(service, schoolId, range)`. |
| `lib/school/chart-theme.ts` | Konstanta warna seri, konfigurasi margin, formatter tick. |
| `lib/format.ts` | `formatRupiah` dipindah dari `page.tsx` baris 10, plus `formatCompactIDR`, `formatPct`, `formatDateID`. |

### 2.4 Struktur `page.tsx` setelah redesign

```
SchoolDashboardPage (Server, async)
├─ auth guard + resolusi schoolId          (dipertahankan persis, baris 19-38)
├─ parse searchParams: schoolId, ay, from, to
├─ Promise.all([ 8 query agregat ])
└─ render
   ├─ DashboardHeader + DashboardFilters   (client)
   ├─ KPIRow                                (5 x KPISparklineCard)
   ├─ grid-cols-12
   │  ├─ col-span-5  CashflowChart
   │  ├─ col-span-4  TuitionCollectionWidget + TuitionAgingWidget
   │  └─ col-span-3  FinancialAlertsPanel
   ├─ grid-cols-12
   │  ├─ col-span-4  PaymentForecastChart
   │  ├─ col-span-5  BudgetUtilizationWidget
   │  └─ col-span-3  QuickAIChatWidget
   └─ RecentActivityTable
```

Blok guard autentikasi pada baris 19 sampai 38 disalin tanpa perubahan. Ini titik paling rawan regresi keamanan dan tidak boleh disentuh dalam pekerjaan visual.

---

## 3. Data Aggregation Server Side

### 3.1 Keputusan arsitektur: agregasi di Postgres

Menarik baris mentah ke Next.js lalu menjumlahkan di JavaScript akan gagal skala. `ledger_entries` menerima satu baris per sisi jurnal per transaksi kantin. Sekolah dengan 800 siswa dan 3 transaksi per hari menghasilkan sekitar 144.000 baris entry per bulan. Chart 12M akan menarik 1,7 juta baris.

Rekomendasi: tambah tiga fungsi RPC read only. Fungsi ini tidak mengubah data dan tidak menyentuh RPC akuntansi yang ada.

```sql
-- fungsi 1: deret harian inflow, outflow, net, dan saldo akhir
CREATE OR REPLACE FUNCTION public.fn_school_cashflow_daily(
  p_school_id uuid,
  p_from      date,
  p_to        date
) RETURNS TABLE (
  bucket_date date,
  inflow      numeric,
  outflow     numeric,
  net_flow    numeric,
  closing_balance numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH acct AS (
    SELECT id FROM public.ledger_accounts
    WHERE owner_school_id = p_school_id
      AND account_type = 'school_escrow'
      AND is_active
  ),
  ent AS (
    SELECT t.business_date,
           e.signed_amount,
           e.balance_after,
           e.entry_seq
    FROM public.ledger_entries e
    JOIN public.ledger_transactions t ON t.id = e.transaction_id
    WHERE e.account_id IN (SELECT id FROM acct)
      AND t.business_date BETWEEN p_from AND p_to
  )
  SELECT d::date AS bucket_date,
         COALESCE(SUM(ent.signed_amount) FILTER (WHERE ent.signed_amount > 0), 0),
         COALESCE(-SUM(ent.signed_amount) FILTER (WHERE ent.signed_amount < 0), 0),
         COALESCE(SUM(ent.signed_amount), 0),
         COALESCE(
           (SELECT e2.balance_after FROM ent e2
             WHERE e2.business_date <= d::date
             ORDER BY e2.business_date DESC, e2.entry_seq DESC LIMIT 1), 0)
  FROM generate_series(p_from, p_to, interval '1 day') d
  LEFT JOIN ent ON ent.business_date = d::date
  GROUP BY d
  ORDER BY d;
$$;
```

Konvensi tanda. Pada `ledger_entries`, debit bernilai positif dan kredit bernilai negatif (`schema_v3.sql` baris 496). Akun `school_escrow` adalah akun aset, sehingga debit berarti kas masuk. Asumsi ini harus diverifikasi terhadap `ledger_accounts.normal_balance` untuk `school_escrow` sebelum query dipakai. Jika `normal_balance` ternyata kredit, tanda inflow dan outflow harus dibalik dan seluruh KPI akan salah arah.

`SECURITY INVOKER` dipilih agar RLS tetap berlaku. Jika `page.tsx` tetap memakai `createServiceClient()` yang memintas RLS seperti pada kode sekarang, maka isolasi tenant sepenuhnya bergantung pada filter `schoolId` di aplikasi. Ini utang keamanan yang sudah ada di kode lama, bukan yang diperkenalkan redesign ini, tetapi patut dicatat.

### 3.2 KPI Cards

| KPI | Sumber | Query |
|---|---|---|
| Cash Position | `ledger_accounts` | `select balance where owner_school_id = :id and account_type = 'school_escrow' and is_active`. Sparkline dari `closing_balance` RPC 3.1 rentang 30 hari. |
| Total Inflow | RPC 3.1 | `SUM(inflow)` pada rentang aktif. Delta vs periode sebelumnya dengan panjang rentang yang sama. |
| Total Outflow | RPC 3.1 | `SUM(outflow)`. `invertPolarity = true` pada `TrendPill`. |
| Tuition Collection | `spp_invoices` | `SUM(amount_paid) / SUM(amount)` untuk `period` di rentang. Perhatikan: `page.tsx` baris 56 sekarang menghitung rate berbasis jumlah invoice, bukan nominal. Mockup menampilkan `87.4%` bersanding dengan `Rp 1.82B collected`, yang mengimplikasikan basis nominal. Ini perubahan definisi metrik dan harus disetujui, bukan diam diam diganti. |
| Outstanding | `spp_invoices` | `SUM(amount - amount_paid) where status in ('UNPAID','FAILED','OVERDUE')`. Persentase overdue = outstanding dengan `due_date < current_date` dibagi total outstanding. |

Enum `invoice_status_t` harus dikonfirmasi. Kode lama pada baris 53 memakai `FAILED` dan `OVERDUE`, indeks `idx_spp_overdue` pada baris 755 memakai `UNPAID`, `FAILED`, `OVERDUE`, dan default kolom adalah `UNPAID`. Ketiganya konsisten, `PAID` menjadi status keempat.

### 3.3 Tuition Collection dan Aging

```sql
CREATE OR REPLACE FUNCTION public.fn_school_tuition_aging(
  p_school_id uuid,
  p_as_of     date DEFAULT current_date
) RETURNS TABLE (bucket text, amount numeric, invoice_count integer)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT CASE
           WHEN due_date >= p_as_of THEN 'current'
           WHEN p_as_of - due_date BETWEEN 1  AND 30 THEN 'd1_30'
           WHEN p_as_of - due_date BETWEEN 31 AND 60 THEN 'd31_60'
           WHEN p_as_of - due_date BETWEEN 61 AND 90 THEN 'd61_90'
           ELSE 'd90_plus'
         END,
         SUM(amount - amount_paid),
         COUNT(*)::int
  FROM public.spp_invoices
  WHERE school_id = p_school_id
    AND status IN ('UNPAID','FAILED','OVERDUE')
  GROUP BY 1;
$$;
```

Query ini memanfaatkan indeks parsial `idx_spp_overdue (school_id, due_date)` yang sudah ada. Tidak perlu indeks baru.

### 3.4 Budget vs Actual

Jika Opsi A dipilih, migrasi baru:

```sql
CREATE TYPE public.budget_unit_t AS ENUM (
  'ACADEMIC','OPERATIONS','HR_PAYROLL','IT','FACILITIES','STUDENT_ACTIVITIES'
);

CREATE TABLE IF NOT EXISTS public.institution_budgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  fiscal_year  text NOT NULL,                    -- '2024/2025'
  unit         public.budget_unit_t NOT NULL,
  budget_amount public.idr_amt NOT NULL CHECK (budget_amount >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_budget_school_year_unit UNIQUE (school_id, fiscal_year, unit)
);
```

Sisi Actual dirakit dari dua sumber:

- `HR_PAYROLL` = `SUM(net_salary)` dari `institution_payroll` dengan `status = 'DISBURSED'` dan `period` di dalam tahun ajaran.
- Lima unit lain = `SUM(COALESCE(reviewed_amount, amount))` dari `institution_procurement` dengan `status = 'PAID'`, dikelompokkan per unit.

Masalah pemetaan yang harus diselesaikan. `institution_procurement.category` bertipe `text` bebas tanpa constraint (migrasi baris 129). Tidak ada jaminan nilainya masuk salah satu dari enam unit. Dua pilihan: tambah kolom `budget_unit public.budget_unit_t` ke `institution_procurement` dengan default `'OPERATIONS'`, atau buat tabel pemetaan `institution_category_map(school_id, category, unit)`. Pilihan pertama lebih sederhana dan lebih cepat dikueri. Tanpa salah satunya, widget Budget vs Actual tidak dapat dibangun dari data nyata.

Gunakan `COALESCE(reviewed_amount, amount)` dan bukan `amount` saja, karena `reviewed_amount` adalah nilai hasil koreksi OCR dan merupakan nilai yang benar benar dibayarkan.

### 3.5 Payment Forecast

Ini widget dengan risiko integritas tertinggi. Mockup menampilkan "Expected collection next 30 days Rp 2.14B" dan "Confidence Level: High" tanpa metodologi. Menampilkan label High yang di-hardcode pada sebuah produk finansial adalah klaim yang tidak dapat dipertanggungjawabkan.

Definisi yang diusulkan, sederhana dan dapat diaudit:

- Upcoming billing = `SUM(amount - amount_paid)` dari `spp_invoices` dengan `due_date BETWEEN current_date AND current_date + 30` dan `status <> 'PAID'`, dikelompokkan per `due_date`.
- Historical collection rate `r` = rata rata tertimbang rasio `SUM(amount_paid)/SUM(amount)` untuk 3 periode `period` terakhir yang sudah lewat jatuh tempo.
- Expected collection = `upcoming_billing * r`.
- Confidence = fungsi dari deviasi standar `r` pada 3 periode tersebut. `High` bila stdev < 5 poin persen dan jumlah invoice sampel >= 100. `Medium` bila stdev < 12 poin persen. `Low` selain itu.

Ambang batas ini adalah pilihan desain, bukan standar akuntansi, dan harus ditulis sebagai tooltip pada kartu. Jika tim tidak bersedia mendefinisikan metodologi, widget ini sebaiknya dihapus dari scope daripada menampilkan angka yang tidak dapat dipertahankan saat ditanya juri.

### 3.6 Financial Alerts

Alert diturunkan di server dari data yang sudah difetch, tidak memerlukan query tambahan dan tidak memerlukan tabel baru.

| Rule | Kondisi | Severity | Teks |
|---|---|---|---|
| R1 | Delta outstanding vs periode sebelumnya > +5 poin persen | Critical | Tunggakan SPP naik X persen bulan ini |
| R2 | `cash_position` < `SUM(net_salary)` payroll periode berjalan | Critical | Saldo kas di bawah kebutuhan payroll periode ini |
| R3 | Utilisasi budget unit mana pun > 90 persen | Attention | Utilisasi anggaran unit Y mencapai Z persen |
| R4 | `COUNT(*)` procurement dengan `status IN ('SUBMITTED','UNDER_REVIEW')` > 0 | Information | N tagihan supplier menunggu persetujuan |
| R5 | Aging bucket `d90_plus` > 10 persen dari total outstanding | Critical | Piutang di atas 90 hari melebihi 10 persen |

Urutkan Critical, Attention, Information. Batasi 4 item terlihat, sisanya di balik "View All" menuju `/school/audit`.

R2 patut diperhatikan. `page.tsx` sekarang tidak pernah membaca `institution_payroll`. Rule ini menambah satu query ringan yang diagregasi (`select net_salary.sum()` via PostgREST atau RPC kecil).

### 3.7 Recent Financial Activity

```
service.from("ledger_transactions")
  .select("id, business_date, source, source_table, description, ledger_entries(signed_amount)")
  .eq("school_id", schoolId)
  .gte("business_date", from).lte("business_date", to)
  .order("business_date", { ascending: false })
  .limit(10)
```

Kategori diturunkan dari `source` (enum `ledger_source_t`) dan `source_table`, bukan dari string bebas. Nominal diambil dari sisi jurnal yang menyentuh akun escrow sekolah. Status pada tabel harus merefleksikan status entitas sumber (`spp_invoices.status`, `institution_payroll.status`, `institution_procurement.status`), sehingga diperlukan satu round trip tambahan per source_table, atau sebuah view gabungan. Untuk 10 baris, dua atau tiga query paralel per source_table masih dapat diterima.

### 3.8 Pola fetch di `page.tsx`

```ts
const [cashflow, aging, kpi, budget, forecast, activity, payroll, procurement] =
  await Promise.all([
    getCashflowSeries(service, schoolId, range),
    getTuitionAging(service, schoolId),
    getTuitionKpi(service, schoolId, range),
    getBudgetVsActual(service, schoolId, academicYear),
    getPaymentForecast(service, schoolId),
    getRecentActivity(service, schoolId, range),
    getPayrollObligation(service, schoolId, period),
    getPendingProcurementCount(service, schoolId),
  ]);
const alerts = deriveAlerts({ kpi, budget, aging, cashflow, payroll, procurement });
```

`Promise.all` wajib. Menjalankan delapan query secara berurutan menambah latensi secara linear. Tambahkan `export const revalidate = 60` atau `dynamic = "force-dynamic"` sesuai kebutuhan kesegaran data. Untuk dashboard treasury, data basi 60 detik dapat diterima dan mengurangi beban database secara signifikan.

Tambahkan `loading.tsx` di `app/(school)/school/` berisi skeleton yang meniru tata letak grid, sehingga tidak muncul layar kosong saat delapan query berjalan.

---

## 4. Strategi Refactoring Sidebar

### 4.1 Risiko yang harus dihindari

1. Mengubah `href` akan mematahkan bookmark, deep link, dan skrip demo.
2. `Sidebar.tsx` baris 91 membangun id dari label: `school-nav-${label.toLowerCase().replace(/\s+/g,"-")}`. Menambahkan prefix nomor mengubah id `school-nav-dashboard` menjadi `school-nav-01-home`. Jika ada test E2E atau skrip walkthrough yang menargetkan id lama, semuanya patah secara diam diam. Solusi: pindahkan `id` menjadi field eksplisit di `NAV_ITEMS`, jangan diturunkan dari label.
3. Daftar 8 modul pada permintaan tidak memuat `/school/profile` dan `/school/settings` yang ada di `NAV_ITEMS` sekarang. Rute tersebut tetap harus dapat dijangkau. Tempatkan sebagai menu sekunder di footer sidebar, bukan dihapus.
4. Logika `active` pada baris 86 memakai `pathname.startsWith(href)`. Dengan grup baru, `/school/students` harus menyalakan grup Billing and Student Management. `startsWith` pada href grup tidak akan cocok karena grup tidak punya href tunggal. Perlu pencocokan terhadap daftar href anak.

### 4.2 Struktur data baru

```ts
type NavLeaf  = { kind: "leaf";  id: string; href: string; label: string; icon: LucideIcon };
type NavGroup = { kind: "group"; id: string; label: string; icon: LucideIcon; children: NavLeaf[] };

const NAV_ITEMS: (NavLeaf | NavGroup)[] = [
  { kind: "leaf",  id: "school-nav-dashboard",   href: "/school",             label: "Home",                 icon: LayoutDashboard },
  { kind: "leaf",  id: "school-nav-assets",      href: "/school/assets",      label: "Asset Management",     icon: Boxes },
  { kind: "group", id: "school-nav-billing",     label: "Billing & Student Management", icon: Users, children: [
      { kind: "leaf", id: "school-nav-students", href: "/school/students", label: "Roster Siswa & NFC", icon: Users },
      { kind: "leaf", id: "school-nav-spp",      href: "/school/spp",      label: "Tagihan & Multi-Fee", icon: FileText },
  ]},
  { kind: "leaf",  id: "school-nav-payroll",     href: "/school/payroll",     label: "Payroll & Employee",   icon: Wallet },
  { kind: "leaf",  id: "school-nav-procurement", href: "/school/procurement", label: "Procurement & Supplier", icon: ShoppingCart },
  { kind: "leaf",  id: "school-nav-financial",   href: "/school/financial",   label: "Institution Financing", icon: Landmark },
  { kind: "leaf",  id: "school-nav-audit",       href: "/school/audit",       label: "Institution Reporting", icon: FileText },
  { kind: "leaf",  id: "school-nav-ai",          href: "/school/ai",          label: "AI Institution Assistant", icon: Sparkles },
];

const SECONDARY_ITEMS: NavLeaf[] = [
  { kind: "leaf", id: "school-nav-profil-sekolah", href: "/school/profile",  label: "Profil Sekolah", icon: User },
  { kind: "leaf", id: "school-nav-pengaturan",     href: "/school/settings", label: "Pengaturan",     icon: Settings },
];
```

Seluruh id lama dipertahankan persis. Nomor `01` sampai `08` dirender sebagai elemen `<span>` terpisah bergaya `text-white/45 tabular-nums`, bukan bagian dari string label. Ini menjaga id stabil dan membuat nomor dapat disembunyikan saat sidebar collapsed.

### 4.3 Logika active

```ts
const leafHrefs = (item: NavLeaf | NavGroup): string[] =>
  item.kind === "leaf" ? [item.href] : item.children.map((c) => c.href);

const isActive = (item: NavLeaf | NavGroup) =>
  leafHrefs(item).some((h) => (h === "/school" ? pathname === h : pathname.startsWith(h)));
```

Kondisi khusus `h === "/school"` mempertahankan perilaku baris 86 yang sudah benar, mencegah item Home menyala di seluruh subrute.

### 4.4 Perilaku grup

Grup default terbuka jika salah satu anaknya aktif. State `openGroups` disimpan di `useState` dengan inisialisasi turunan dari `pathname`. Saat `collapsed = true`, grup dirender sebagai satu ikon dan submenu muncul sebagai flyout on hover, atau grup dipaksa tertutup. Flyout menambah kompleksitas dan kasus tepi keyboard, sehingga untuk iterasi pertama pilih perilaku sederhana: klik ikon grup saat collapsed akan meng-expand sidebar dan membuka grup.

Aksesibilitas: tombol grup memerlukan `aria-expanded` dan `aria-controls`, kontainer submenu memerlukan `id` yang cocok. Tanpa ini, pengguna screen reader tidak dapat mengetahui ada submenu.

### 4.5 Yang tidak berubah

Footer status SNAP BI (baris 107 sampai 119) dan tombol logout (baris 121 sampai 129) dipertahankan apa adanya, termasuk id `school-logout-sidebar-btn`. Hanya token warna latar yang menyesuaikan gradient baru.

---

## 5. Verifikasi

### 5.1 Gerbang otomatis

Jalankan berurutan, seluruhnya harus lolos sebelum commit:

```
npx tsc --noEmit
npm run lint
npm run build
```

`npx tsc --noEmit` adalah gerbang paling penting karena tiga alasan spesifik pada perubahan ini. Pertama, union `NavLeaf | NavGroup` akan mengungkap setiap tempat yang masih mengasumsikan `NAV_ITEMS` adalah array datar dengan `href`. Kedua, tipe kembalian RPC Supabase tidak otomatis diketahui, sehingga `.rpc("fn_school_cashflow_daily", ...)` akan bertipe `any` kecuali tipe database diregenerasi. Ketiga, `as const` pada `NAV_ITEMS` lama menghasilkan tipe readonly literal yang tidak kompatibel dengan array bertipe union yang baru.

Regenerasi tipe database setelah migrasi baru diterapkan:

```
npx supabase gen types typescript --project-id <ref> --schema public > types/supabase.ts
```

Melewatkan langkah ini akan membuat seluruh field hasil RPC bertipe `any` dan `tsc --noEmit` akan lolos secara palsu.

### 5.2 Verifikasi data, bukan hanya kompilasi

Kompilasi bersih tidak membuktikan angkanya benar. Uji berikut wajib:

1. Rekonsiliasi Cash Position. Nilai `ledger_accounts.balance` harus sama persis dengan `closing_balance` hari terakhir dari RPC 3.1. Jika berbeda, konvensi tanda atau pemilihan `entry_seq` salah.
2. Rekonsiliasi cashflow. `SUM(inflow) - SUM(outflow)` untuk rentang penuh harus sama dengan `closing_balance` akhir dikurangi `closing_balance` awal.
3. Rekonsiliasi aging. `SUM` seluruh bucket harus sama dengan KPI Outstanding. Jika tidak, ada invoice dengan status di luar tiga status yang difilter.
4. Rekonsiliasi collection rate. `collected + outstanding` harus sama dengan `total_billing`.
5. Isolasi tenant. Login sebagai admin sekolah A, panggil halaman dengan `?schoolId=<id sekolah B>` di URL. Halaman harus menolak atau jatuh ke sekolah A, tidak menampilkan data B.
6. Kasus kosong. Sekolah tanpa invoice, tanpa entry ledger, tanpa payroll. Seluruh widget harus menampilkan keadaan kosong, bukan `NaN`, `Infinity`, atau `Rp NaN`. Pembagi nol muncul di collection rate, persentase aging, dan utilisasi budget.

### 5.3 Checklist QA visual

- [ ] Lima kartu KPI sejajar pada 1440px, membungkus rapi pada 1280px, 1024px, dan 768px tanpa overflow horizontal.
- [ ] Sparkline tidak menabrak nilai KPI pada label terpanjang, misalnya `Rp 152.450.000.000`.
- [ ] Toggle 7D, 30D, 3M, 12M mengubah sumbu X dan tidak menyebabkan chart runtuh ke tinggi nol.
- [ ] Tooltip chart menampilkan format rupiah lokal, bukan angka mentah.
- [ ] Warna seri konsisten antara legenda, garis, dan sparkline kartu terkait.
- [ ] Progress bar Tuition Collection berhenti di 100 persen secara visual meski nilai melebihi 100.
- [ ] Baris budget di atas 100 persen berwarna `fin-outflow` dan menampilkan ikon peringatan.
- [ ] Panel alert kosong menampilkan pesan positif, bukan panel kosong tanpa konten.
- [ ] Sidebar collapsed menyembunyikan label dan nomor, ikon tetap terpusat, tooltip muncul saat hover.
- [ ] Grup Billing menyala saat berada di `/school/students` maupun `/school/spp`.
- [ ] Item Home tidak menyala saat berada di subrute mana pun.
- [ ] Seluruh id navigasi lama masih ada di DOM. Verifikasi dengan `document.querySelectorAll('[id^="school-nav-"]')`.
- [ ] `prefers-reduced-motion: reduce` menonaktifkan animasi counter dan animasi masuk kartu.
- [ ] Kontras teks nav non aktif terhadap gradient sidebar memenuhi 4.5:1.
- [ ] Navigasi keyboard: Tab menjangkau seluruh item, Enter membuka grup, focus ring terlihat.
- [ ] Widget AI mengirim ke `/api/v1/ai/treasury-advisor` dan tombol pill benar benar mengisi prompt, tidak sekadar dekoratif.

### 5.4 Verifikasi performa

Ukur waktu render server halaman sebelum dan sesudah. Delapan query paralel plus dua RPC agregat sebaiknya tetap di bawah 800 ms pada dataset demo. Jika RPC cashflow 12M melebihi 300 ms, tambahkan indeks pendukung pada `ledger_transactions (school_id, business_date)` yang sudah ada sebagai `idx_ledger_txn_school_date`, dan pertimbangkan materialized view harian yang di-refresh terjadwal.

---

## 6. Urutan Eksekusi yang Disarankan

| Fase | Isi | Keluaran yang dapat diuji |
|---|---|---|
| 0 | Putuskan Blocker 1 sampai 4. Konfirmasi `normal_balance` akun `school_escrow`. Konfirmasi perubahan definisi collection rate. | Keputusan tertulis |
| 1 | `lib/format.ts`, `lib/school/chart-theme.ts`, token theme di `globals.css`, primitif `DashboardCard`, `Sparkline`, `AnimatedNumber`, `TrendPill`, `StatusBadge` | Halaman lama tetap jalan, primitif dapat dirender terpisah |
| 2 | Refactor `Sidebar.tsx`. Fase paling berisiko regresi navigasi, kerjakan terpisah agar mudah di-revert. | Seluruh rute lama dapat diakses, id lama utuh |
| 3 | Migrasi SQL: dua RPC read only, opsional tabel budget dan kolom `budget_unit`. Regenerasi tipe. | RPC dapat dipanggil dari SQL editor dan hasilnya direkonsiliasi manual |
| 4 | `lib/school/dashboard-queries.ts` dan `dashboard-types.ts`. Belum menyentuh UI. | Log hasil query dibandingkan dengan query manual |
| 5 | KPI row dan CashflowChart | Baris atas dashboard tampil dengan data nyata |
| 6 | Tuition, Aging, Alerts | Baris tengah selesai |
| 7 | Forecast, Budget, AI widget, Recent Activity | Baris bawah selesai |
| 8 | `loading.tsx`, responsivitas, aksesibilitas, checklist 5.3 | Siap review |

Fase 2 sengaja dipisah dari fase 5 sampai 7. Menggabungkan refactor navigasi dengan redesign dashboard dalam satu commit membuat penyebab regresi sulit diisolasi ketika ada rute yang tiba tiba tidak dapat diakses.

---

## 7. Ringkasan Keputusan yang Menunggu Persetujuan

1. Opsi mana untuk tabel budget: A tambah tabel, B baseline turunan, atau widget dihapus dari scope.
2. Kolom Account pada tabel aktivitas: ganti menjadi Reference berbasis BNI, atau tambah entitas rekening bank multi provider ke skema.
3. Notasi angka ringkas: `Rp 12,8 M` gaya Indonesia, atau `Rp 12.8B` mengikuti mockup secara harfiah.
4. Definisi collection rate: berbasis nominal seperti mockup, atau tetap berbasis jumlah invoice seperti kode sekarang.
5. Metodologi dan ambang Confidence Level pada Payment Forecast, atau hapus widget.
6. Pemetaan `institution_procurement.category` ke unit anggaran: kolom enum baru atau tabel pemetaan.
