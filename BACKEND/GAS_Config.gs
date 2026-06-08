// =============================================================================
// GAS_Config.gs — Konfigurasi Global EFM Absensi System
// =============================================================================
// File ini berisi semua konstanta konfigurasi yang digunakan di seluruh project.
// GANTI nilai placeholder di bawah sebelum deploy.
// =============================================================================

// -----------------------------------------------------------------------------
// GOOGLE SHEETS CONFIGURATION
// -----------------------------------------------------------------------------

// ID Google Spreadsheet utama (ambil dari URL: /spreadsheets/d/[SHEET_ID]/edit)
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';

// Nama sheet (tab) untuk setiap tabel data
const SHEETS = {
  USERS        : 'Users',          // Data pelatih/PIC (kodePIC, PIN, nama, dll)
  ORDERS       : 'Orders',         // Data order/paket klien
  ATTENDANCE   : 'Attendance',     // Rekap absensi per sesi
  PAYMENTS     : 'Payments',       // Permintaan & status pembayaran
  PIN_REQUESTS : 'PinResetRequests', // Permintaan reset PIN
  SESSIONS     : 'Sessions',       // Token sesi login aktif
  LOCATIONS    : 'Locations',      // Koordinat GPS lokasi yang valid per order
};

// -----------------------------------------------------------------------------
// GOOGLE DRIVE CONFIGURATION
// -----------------------------------------------------------------------------

// ID folder Google Drive untuk menyimpan foto sesi absensi
const DRIVE_FOLDER_PHOTO_ID = 'YOUR_DRIVE_FOLDER_PHOTO_ID_HERE';

// ID folder Google Drive untuk menyimpan file rekap PDF
const DRIVE_FOLDER_REKAP_ID = 'YOUR_DRIVE_FOLDER_REKAP_ID_HERE';

// -----------------------------------------------------------------------------
// SESSION & AUTH CONFIGURATION
// -----------------------------------------------------------------------------

// Durasi sesi login (dalam jam)
const SESSION_DURATION_HOURS = 24;

// Panjang token sesi (karakter hex)
const SESSION_TOKEN_LENGTH = 32;

// Maksimum percobaan login gagal sebelum lockout
const MAX_LOGIN_ATTEMPTS = 3;

// Durasi lockout setelah gagal login (dalam menit)
const LOCKOUT_DURATION_MINUTES = 5;

// Panjang PIN (digit numerik)
const PIN_LENGTH = 6;

// -----------------------------------------------------------------------------
// GPS VALIDATION CONFIGURATION
// -----------------------------------------------------------------------------

// Radius maksimum jarak dari lokasi yang valid (dalam meter)
const GPS_RADIUS_METERS = 300;

// Bumi radius (meter) — digunakan untuk kalkulasi Haversine
const EARTH_RADIUS_METERS = 6371000;

// -----------------------------------------------------------------------------
// PHOTO UPLOAD CONFIGURATION
// -----------------------------------------------------------------------------

// Ukuran maksimum foto yang diterima (dalam bytes) — 2MB
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

// Format foto yang diterima
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// -----------------------------------------------------------------------------
// ADMIN CONFIGURATION
// -----------------------------------------------------------------------------

// Nomor WhatsApp admin (format internasional tanpa +)
const ADMIN_WHATSAPP = '6281119920666';

// Email admin untuk notifikasi (opsional — jika menggunakan MailApp)
const ADMIN_EMAIL = 'admin@efm.com';

// -----------------------------------------------------------------------------
// CORS & REQUEST CONFIGURATION
// -----------------------------------------------------------------------------

// Allowed origins untuk CORS (gunakan '*' untuk semua, atau domain spesifik)
const ALLOWED_ORIGIN = '*';

// -----------------------------------------------------------------------------
// COLUMN INDICES — SHEET: Users
// Sesuaikan dengan urutan kolom di Google Sheet Anda (0-indexed)
// -----------------------------------------------------------------------------
const COL_USERS = {
  ID           : 0,   // A — ID unik pelatih
  KODE_PIC     : 1,   // B — Kode PIC login
  NAMA_PANGGIL : 2,   // C — Nama panggilan
  NAMA_LENGKAP : 3,   // D — Nama lengkap
  PIN          : 4,   // E — PIN (disimpan sebagai hash MD5/SHA)
  STATUS       : 5,   // F — Status akun (active/inactive/locked)
  LOGIN_ATTEMPT: 6,   // G — Jumlah percobaan login gagal
  LOCKED_UNTIL : 7,   // H — Timestamp lockout berakhir
  BANK_NAME    : 8,   // I — Nama bank
  BANK_ACCOUNT : 9,   // J — Nomor rekening
  BANK_HOLDER  : 10,  // K — Nama pemilik rekening
  CREATED_AT   : 11,  // L — Tanggal dibuat
};

// -----------------------------------------------------------------------------
// COLUMN INDICES — SHEET: Orders
// -----------------------------------------------------------------------------
const COL_ORDERS = {
  ORDER_ID     : 0,   // A — Order ID (dari QR code)
  CLIENT_NAME  : 1,   // B — Nama klien
  PACKAGE_NAME : 2,   // C — Nama paket (misal: 10 sesi yoga)
  TOTAL_SESI   : 3,   // D — Total sesi dalam paket
  USED_SESI    : 4,   // E — Sesi yang sudah digunakan
  KODE_PIC     : 5,   // F — Kode PIC yang menangani
  PRICE        : 6,   // G — Harga paket
  STATUS       : 7,   // H — Status order (active/completed/cancelled)
  GPS_LAT      : 8,   // I — Latitude lokasi valid
  GPS_LNG      : 9,   // J — Longitude lokasi valid
  CREATED_AT   : 10,  // K — Tanggal order dibuat
  EXPIRED_AT   : 11,  // L — Tanggal kadaluarsa paket
};

// -----------------------------------------------------------------------------
// COLUMN INDICES — SHEET: Attendance
// -----------------------------------------------------------------------------
const COL_ATTENDANCE = {
  ID           : 0,   // A — ID unik absensi
  ORDER_ID     : 1,   // B — Order ID
  CLIENT_NAME  : 2,   // C — Nama klien
  KODE_PIC     : 3,   // D — Kode PIC
  NAMA_PIC     : 4,   // E — Nama PIC
  SESI_KE      : 5,   // F — Sesi ke-N dari total
  DATE         : 6,   // G — Tanggal absensi
  TIME         : 7,   // H — Jam absensi
  GPS_LAT      : 8,   // I — Latitude saat absensi
  GPS_LNG      : 9,   // J — Longitude saat absensi
  GPS_DISTANCE : 10,  // K — Jarak dari lokasi valid (meter)
  PHOTO_URL    : 11,  // L — URL foto di Google Drive
  DEVICE       : 12,  // M — User-agent device
  STATUS       : 13,  // N — Status (valid/rejected)
  PAYMENT_ID   : 14,  // O — ID payment terkait (diisi saat dibayar)
};

// -----------------------------------------------------------------------------
// COLUMN INDICES — SHEET: Payments
// -----------------------------------------------------------------------------
const COL_PAYMENTS = {
  ID              : 0,   // A — ID unik payment
  ORDER_ID        : 1,   // B — Order ID
  KODE_PIC        : 2,   // C — Kode PIC
  NAMA_PIC        : 3,   // D — Nama PIC
  TOTAL_SESI      : 4,   // E — Total sesi yang ditagih
  AMOUNT          : 5,   // F — Nominal pembayaran
  STATUS          : 6,   // G — Status (pending/approved/rejected)
  SIGNATURE_URL   : 7,   // H — URL tanda tangan digital
  REKAP_URL       : 8,   // I — URL file rekap PDF
  SUBMITTED_AT    : 9,   // J — Tanggal pengajuan
  PROCESSED_AT    : 10,  // K — Tanggal diproses admin
  ADMIN_NOTE      : 11,  // L — Catatan admin
};

// -----------------------------------------------------------------------------
// COLUMN INDICES — SHEET: Sessions
// -----------------------------------------------------------------------------
const COL_SESSIONS = {
  TOKEN        : 0,   // A — Token sesi
  KODE_PIC     : 1,   // B — Kode PIC
  CREATED_AT   : 2,   // C — Waktu dibuat
  EXPIRES_AT   : 3,   // D — Waktu kadaluarsa
  DEVICE       : 4,   // E — User-agent device
};

// -----------------------------------------------------------------------------
// COLUMN INDICES — SHEET: PinResetRequests
// -----------------------------------------------------------------------------
const COL_PIN_REQUESTS = {
  ID           : 0,   // A — ID request
  KODE_PIC     : 1,   // B — Kode PIC
  STATUS       : 2,   // C — Status (pending/approved/rejected)
  REASON       : 3,   // D — Alasan reset
  NEW_PIN      : 4,   // E — PIN baru (diisi admin saat approve)
  REQUESTED_AT : 5,   // F — Waktu request
  PROCESSED_AT : 6,   // G — Waktu diproses
};
