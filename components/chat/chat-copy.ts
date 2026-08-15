export type PersonaKey = "parent" | "merchant" | "school";

export const CHAT_COPY: Record<
  PersonaKey,
  {
    judul: string;
    sapaan: string;
    placeholder: string;
    chips: string[];
  }
> = {
  parent: {
    judul: "VALO Family Advisor",
    sapaan:
      "Halo! Saya asisten finansial keluarga Anda. Ada yang ingin Anda tanyakan tentang jajan, tabungan, atau SPP anak?",
    placeholder: "Tanya sisa pagu, tabungan vault, atau SPP...",
    chips: [
      "Berapa sisa pagu jajan anak saya hari ini?",
      "Bagaimana progres tabungan vault anak saya?",
      "Apakah ada tagihan SPP yang belum lunas?",
      "Rekap belanja kantin anak minggu ini",
    ],
  },
  merchant: {
    judul: "VALO Kantin Advisor",
    sapaan:
      "Halo! Asisten kantin siap membantu. Tanyakan omzet, menu terlaris, stok, atau status pencairan BNI.",
    placeholder: "Tanya omzet, stok menu, pencairan...",
    chips: [
      "Berapa omzet dan jumlah transaksi hari ini?",
      "Menu apa yang paling laris minggu ini?",
      "Menu apa saja yang stoknya perlu direstok?",
      "Kapan uang hasil penjualan saya cair?",
    ],
  },
  school: {
    judul: "VALO Treasury Advisor",
    sapaan:
      "Selamat datang. Asisten treasury siap menyajikan statistik SPP, saldo escrow, dan status kartu sekolah.",
    placeholder: "Tanya tingkat penagihan SPP, saldo escrow, kartu...",
    chips: [
      "Berapa persentase penagihan SPP bulan ini?",
      "Tampilkan daftar SPP tertunggak kelas 10",
      "Berapa saldo escrow dan rekomendasi penempatan dana?",
      "Bagaimana statistik kartu dan enrollment siswa?",
    ],
  },
};
