// =============================================
// EFM SYSTEM V3 — CONFIG
// Multi-file architecture:
//   - Database PIC  → DATA OPERASIONAL EFM 2026
//   - Database Orderan → SISTEM ORDER PP 2026
//   - Attendance/Sessions → EFM LOGIN ATTENDANCE (file ini)
// =============================================

const EFM_CONFIG = {

  // ─── FILE IDs (Google Sheets eksternal) ────
  FILE_OPERASIONAL_ID: "1_TJtcxuXR0MfhEnwGB5rKHrkBdPGNkbsO2UX1GI0Q4Q", // DATA OPERASIONAL EFM 2026
  FILE_ORDER_PP_ID:    "1H6Ns21V61y_6FyIzGqNejsMNuKCaxA3xARwRwjN4hmE",  // SISTEM ORDER PP 2026

  // ─── SHEET NAMES ───────────────────────────
  PIC_SHEET:        "Database PIC",     // di FILE_OPERASIONAL_ID
  ORDER_SHEET:      "Database Orderan", // di FILE_ORDER_PP_ID
  ATTENDANCE_SHEET: "ABSENSI_V2",        // di file ini (EFM LOGIN ATTENDANCE)
  SESSION_SHEET:    "SESSIONS_V2",       // di file ini (EFM LOGIN ATTENDANCE)
  PAYMENT_SHEET:    "PAYMENT_REQUESTS",  // di file ini (EFM LOGIN ATTENDANCE)
  REKAP_SHEET:      "REKAP ABSENSI",      // template rekap PDF di file ini

  // ─── KOLOM DATABASE PIC (DATA OPERASIONAL) ─
  // Sheet: "Database PIC" | Kolom A-V (index 0-based)
  // No | Nomor ID | Nama Panggilan | Nama Lengkap | Kode PIC |
  // Tempat Lahir | Tanggal Lahir | PIN Login | Nomor WA | Email |
  // Nomor KTP | Alamat KTP | Alamat Domisili | Spesialisasi |
  // Jangkauan Wilayah | Nama Bank | Cabang Wilayah | Nomor Rekening |
  // Nama Pemilik Rekening | Tanggal Submit Data | Status | Pakta Integritas
  COL_PIC_NOMOR_ID:  1,  // B — Nomor ID (001-PIC/BGS/III/2026)
  COL_NAMA_PANGGIL:  2,  // C — Nama Panggilan
  COL_NAMA_LENGKAP:  3,  // D — Nama Lengkap
  COL_KODE_PIC:      4,  // E — Kode PIC (BGS, ROB, dll)
  COL_PIN:           7,  // H — PIN Login (6 digit, diisi saat Sign Up)
  COL_WA:            8,  // I — Nomor WhatsApp
  COL_SPESIALIS:     13, // N — Spesialisasi
  COL_BANK:          15, // P — Nama Bank
  COL_CABANG:        16, // Q — Cabang Wilayah
  COL_REKENING:      17, // R — Nomor Rekening
  COL_ATAS_NAMA:     18, // S — Nama Pemilik Rekening
  COL_STATUS_PIC:    20, // U — Status (Aktif / Nonaktif)

  // ─── KOLOM DATABASE ORDERAN (SISTEM ORDER PP) ─
  // Sheet: "Database Orderan" | 54 kolom A-BB (index 0-based)
  // A:No  B:ID Order  C:Tgl Order
  // D:Status Pembayaran  E:Status PKS  F:Status Agreement  G:Status Paket
  // H:ID Pendaftar  I:Nama Lengkap Pendaftar  J:Nama Panggilan Pendaftar
  // K:No.WA Pendaftar  L:Email Pendaftar
  // M:ID Klien  N:Nama Panggilan Klien  O:Hubungan Klien
  // P:Hari  Q:Jam  R:Lokasi  S:Wilayah Program  T:Google Maps Link
  // U:Tgl Mulai  V:Tgl Berakhir  W:Catatan Khusus
  // X:ID Program  Y:Nama Latihan/Terapi  Z:Nama Paket Program
  // AA:Jumlah Partisipan  AB:Jumlah Sesi  AC:Jumlah Pertemuan/Minggu  AD:Masa Habis Paket
  // AE:Nomor ID PIC  AF:Nama Panggilan PIC  AG:Nama Lengkap PIC
  // AH:Biaya PIC Per Sesi  AI:Biaya PIC Per Paket
  // AJ:Biaya Konsultasi  AK:Biaya Buat Program  AL:Biaya Administrasi
  // AM:Total Biaya Dasar  AN:Margin(Rp)  AO:Margin(%)
  // AP:Harga Jual/Sesi  AQ:Harga Jual Paket
  // AR:Diskon(%)  AS:Diskon(Rp)  AT:Harga Jual Setelah Diskon
  // AU:Biaya Lainnya  AV:Keterangan Biaya Lain
  // AW:Kode Promo  AX:Tipe Promo  AY:Total Promo(Rp)
  // AZ:Total Invoice  BA:Link Barcode  BB:Gambar QR
  COL_ORDER_ID:          1,  // B  — ID Order
  COL_STATUS_BAYAR:      3,  // D  — Status Pembayaran Paket
  COL_STATUS_PKS:        4,  // E  — Status PKS Pelatih/Terapis
  COL_STATUS_AGREEMENT:  5,  // F  — Status Agreement Klien
  COL_STATUS_PAKET:      6,  // G  — Status Paket (AKTIF/SELESAI/BATAL)
  COL_NAMA_PENDAFTAR:    8,  // I  — Nama Lengkap Pendaftar
  COL_CLIENT_NAME:       13, // N  — Nama Panggilan Klien
  COL_HARI:              15, // P  — Hari Latihan/Terapi
  COL_JAM:               16, // Q  — Jam Latihan/Terapi
  COL_LOKASI:            17, // R  — Lokasi Latihan/Terapi
  COL_WILAYAH:           18, // S  — Wilayah Program
  COL_GMAPS_LINK:        19, // T  — Google Maps Link
  COL_TGL_MULAI:         20, // U  — Tanggal Mulai Paket
  COL_TGL_SELESAI:       21, // V  — Tanggal Berakhir Paket
  COL_CATATAN:           22, // W  — Catatan Khusus
  COL_NAMA_LATIHAN:      24, // Y  — Nama Latihan/Terapi (Padel, Senam Aerobik, dll)
  COL_PROGRAM:           25, // Z  — Nama Paket Program
  COL_JML_PARTISIPAN:    26, // AA — Jumlah Partisipan
  COL_TOTAL_SESI:        27, // AB — Jumlah Sesi ← KRITIS untuk absensi
  COL_JML_PERTEMUAN:     28, // AC — Jumlah Pertemuan Per Minggu
  COL_MASA_HABIS:        29, // AD — Masa Habis Paket (contoh: "5 Minggu")
  COL_NOMOR_ID_PIC:      30, // AE — Nomor ID PIC
  COL_NAMA_PIC:          31, // AF — Nama Panggilan PIC
  COL_NAMA_LENGKAP_PIC_O:32, // AG — Nama Lengkap PIC (di orderan)
  COL_BIAYA_SESI:        33, // AH — Biaya PIC Per Sesi
  COL_BIAYA_PAKET:       34, // AI — Biaya PIC Per Paket
  COL_BIAYA_LAINNYA:     46, // AU — Biaya Lainnya
  COL_KET_BIAYA_LAIN:    47, // AV — Keterangan Biaya Lain

  // ─── STATUS VALUES ─────────────────────────
  STATUS_AKTIF:        "AKTIF",
  STATUS_SELESAI:      "SELESAI",
  STATUS_BATAL:        "BATAL",
  STATUS_LUNAS:        "LUNAS",
  STATUS_BELUM_BAYAR:  "BELUM BAYAR",
  STATUS_PKS_SUDAH:    "SUDAH",
  STATUS_PKS_BELUM:    "BELUM",

  // ─── GOOGLE DRIVE ──────────────────────────
  DRIVE_FOLDER_ID:  "1vPGg1gHfW9T5rro9BUV4t3EOEE1nJP4B", // folder foto absensi
  REKAP_FOLDER_ID:  "1oJh4oDNYptvRO4jhGFkZyYFu2S17_p_T", // folder PDF rekap lunas

  // ─── GPS ───────────────────────────────────
  GPS_RADIUS_M: 300,

  // ─── SESSION ───────────────────────────────
  SESSION_EXPIRE_HOURS: 12,

  // ─── LOGIN SECURITY ────────────────────────
  MAX_LOGIN_ATTEMPTS: 5,        // Maksimal salah PIN sebelum dikunci
  LOCK_DURATION_MINUTES: 5,     // Durasi kunci (menit) — 5 menit praktis di lapangan

  // ─── ADMIN ─────────────────────────────────
  ADMIN_EMAIL: "bugarnusantarajaya@gmail.com",
  ADMIN_KEY:   "EFM_BNJ_2026",  // Kunci keamanan link email admin (bukan PIN pelatih)

  // ─── WEB APP URL ───────────────────────────
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbw9x7h3ybotWARoncs4nh12Q9dAZCUEMA5tfRkErVelDs58xbGIH9ZgOhN-DooJ9QALZg/exec"
};


// =============================================
// HELPER: Buka sheet di file AKTIF (EFM LOGIN ATTENDANCE)
// =============================================
function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + name);
  return sheet;
}

// =============================================
// HELPER: Buka sheet Database PIC di DATA OPERASIONAL EFM 2026
// =============================================
function getPICSheet_() {
  try {
    const ss = SpreadsheetApp.openById(EFM_CONFIG.FILE_OPERASIONAL_ID);
    const sheet = ss.getSheetByName(EFM_CONFIG.PIC_SHEET);
    if (!sheet) throw new Error("Sheet '" + EFM_CONFIG.PIC_SHEET + "' tidak ditemukan di file Data Operasional");
    return sheet;
  } catch(e) {
    throw new Error("Gagal akses Database PIC: " + e.message);
  }
}

// =============================================
// HELPER: Buka sheet Database Orderan di SISTEM ORDER PP 2026
// =============================================
function getOrderSheet_() {
  try {
    const ss = SpreadsheetApp.openById(EFM_CONFIG.FILE_ORDER_PP_ID);
    const sheet = ss.getSheetByName(EFM_CONFIG.ORDER_SHEET);
    if (!sheet) throw new Error("Sheet '" + EFM_CONFIG.ORDER_SHEET + "' tidak ditemukan di file Sistem Order PP");
    return sheet;
  } catch(e) {
    throw new Error("Gagal akses Database Orderan: " + e.message);
  }
}

// =============================================
// HELPER: Bersihkan nilai
// =============================================
function clean_(val) {
  return (val || "").toString().trim();
}

// =============================================
// HELPER: Parse angka rupiah
// =============================================
function parseRp_(val) {
  if (!val) return 0;
  const num = parseFloat(
    val.toString().replace(/[Rp\s\.]/g, "").replace(",", ".")
  );
  return isNaN(num) ? 0 : num;
}

// =============================================
// HELPER: Format CORS response
// =============================================
function corsResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
