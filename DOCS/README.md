# EFM Absensi — Sistem Absensi Digital

Sistem absensi digital berbasis web untuk pelatih/terapis EFM (Elite Fitness Management). Memungkinkan pencatatan kehadiran sesi latihan klien dengan validasi GPS, scan QR code, dan upload foto bukti.

---

## Daftar Isi

- [Gambaran Umum](#gambaran-umum)
- [Fitur Utama](#fitur-utama)
- [Struktur Project](#struktur-project)
- [Tech Stack](#tech-stack)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Setup & Instalasi](#setup--instalasi)
- [Konfigurasi](#konfigurasi)
- [Alur Penggunaan](#alur-penggunaan)
- [Deployment](#deployment)
- [Backend (Google Apps Script)](#backend-google-apps-script)
- [Keamanan](#keamanan)

---

## Gambaran Umum

EFM Absensi adalah Progressive Web App (PWA) single-page yang dirancang khusus untuk mobile. Pelatih/terapis login menggunakan kode PIC dan PIN 6 digit, kemudian melakukan absensi dengan memindai QR code klien, memvalidasi lokasi GPS, dan mengupload foto sesi.

Data tersimpan di Google Sheets melalui Google Apps Script sebagai backend serverless.

---

## Fitur Utama

### Autentikasi
- Login dengan kode PIC + PIN 6 digit numerik
- Proteksi akun: lockout 5 menit setelah gagal login berulang
- Permintaan reset PIN dengan persetujuan admin
- Sesi persisten via cookie (`EFM_SESSION`, SameSite=Strict)

### Absensi
- Scan QR code klien untuk mendapatkan Order ID
- Validasi lokasi GPS (radius maksimal 300 meter dari lokasi yang ditentukan)
- Upload foto sesi (kompresi otomatis: max 1024px, kualitas 75%)
- Riwayat sesi per klien

### Dashboard
- Tampilan paket aktif
- Ringkasan potensi penghasilan
- Progress sesi per klien
- Tombol aksi cepat (Scan, Riwayat)

### Pembayaran & Rekap
- Tanda tangan digital untuk permintaan pembayaran
- Rekap absensi dengan detail sesi
- Export PDF
- Status pembayaran (Pending / Paid)
- Tampilan informasi rekening bank

---

## Struktur Project

```
efm-absensi/
├── index.html                  # Seluruh aplikasi (HTML + CSS + JS, ~1.800 baris)
├── logo-circle-white.png       # Logo EFM (digunakan di topbar, splash screen)
├── white-logo-circle-pure.png  # Varian logo alternatif
└── README.md                   # Dokumentasi ini
```

> Seluruh aplikasi terdapat dalam satu file `index.html`. Tidak ada proses build, tidak ada dependensi npm/composer.

### Struktur Internal `index.html`

| Bagian | Deskripsi |
|---|---|
| `<head>` | Meta tags, Google Fonts (Poppins, Bebas Neue), inline CSS |
| `<style>` | ~1.000 baris CSS — variabel warna, layout, komponen UI, animasi |
| `<body>` | Semua halaman (`<div class="page" id="page-*">`) |
| `<script>` | Semua logika JS: routing, API calls, GPS, kamera, QR scanner |

### Halaman Aplikasi (`page-*`)

| ID Halaman | Fungsi |
|---|---|
| `page-splash` | Splash screen saat pertama buka |
| `page-login` | Form login PIC + PIN |
| `page-lock` | Layar lockout saat gagal login |
| `page-dashboard` | Dashboard utama setelah login |
| `page-scan` | Scan QR code klien |
| `page-absensi` | Form absensi (GPS + foto) |
| `page-history` | Riwayat sesi per klien |
| `page-profile` | Profil pelatih |
| `page-payment` | Permintaan pembayaran |
| `page-recap` | Rekap absensi |
| `page-pin-reset` | Form permintaan reset PIN |

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | HTML5, CSS3 (Flexbox/Grid), Vanilla JavaScript |
| **UI Font** | Poppins, Bebas Neue (Google Fonts via CDN) |
| **QR Scanner** | [jsQR v1.4.0](https://github.com/cozmo/jsQR) via jsDelivr CDN |
| **Kamera** | Web API `getUserMedia` (environment-facing) |
| **Geolokasi** | Web API `navigator.geolocation` |
| **Backend** | Google Apps Script (serverless) |
| **Database** | Google Sheets (via Apps Script) |
| **File Storage** | Google Drive (foto sesi) |
| **Sesi** | Browser Cookies (`EFM_SESSION`) |

### Dependensi Eksternal (CDN)

```html
<!-- Google Fonts -->
https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Bebas+Neue

<!-- jsQR — QR Code decoder -->
https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js
```

Tidak ada npm packages, tidak ada node_modules, tidak ada build tools.

---

## Arsitektur Sistem

```
┌─────────────────────────────┐
│      Browser (Mobile)       │
│                             │
│  index.html                 │
│  ├── CSS (inline styles)    │
│  ├── HTML pages (SPA)       │
│  └── JavaScript             │
│      ├── Routing (showPage) │
│      ├── GPS validation     │
│      ├── Camera / QR scan   │
│      └── fetch() API calls  │
└──────────────┬──────────────┘
               │ HTTPS POST/GET
               ▼
┌─────────────────────────────┐
│   Google Apps Script (GAS)  │
│   (Backend Serverless)      │
│                             │
│  doPost() / doGet()         │
│  ├── Auth: login, signup    │
│  ├── Attendance recording   │
│  ├── GPS point lookup       │
│  ├── Photo upload → Drive   │
│  └── Payment processing     │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌────────────┐  ┌──────────────┐
│Google      │  │ Google Drive │
│Sheets      │  │ (foto sesi)  │
│(database)  │  └──────────────┘
└────────────┘
```

**Catatan penting:** Seluruh logika bisnis (validasi PIN, perhitungan jarak GPS, penghitungan sesi) dilakukan di Google Apps Script. Frontend hanya menampilkan data dan mengirimkan permintaan.

---

## Setup & Instalasi

### Prasyarat

- Browser modern (Chrome 80+, Firefox 75+, Safari 14+)
- HTTPS diperlukan untuk akses kamera dan geolokasi (Chrome/Firefox)
- Tidak diperlukan Node.js, PHP, Python, atau runtime lainnya

### Menjalankan Secara Lokal

1. Clone repository:
   ```bash
   git clone https://github.com/bugarnusantarajaya-berjaya678/efm-absensi.git
   cd efm-absensi
   ```

2. Buka `index.html` langsung di browser, **atau** gunakan local server sederhana:

   ```bash
   # Python 3
   python3 -m http.server 8080

   # Node.js (npx)
   npx serve .

   # PHP
   php -S localhost:8080
   ```

3. Buka `http://localhost:8080` di browser.

> **Perhatian:** Fitur kamera dan GPS memerlukan HTTPS atau `localhost`. Buka via `http://localhost:8080` untuk pengujian lokal; deploy ke HTTPS untuk produksi.

---

## Konfigurasi

Semua konfigurasi hardcoded di dalam `index.html` (bagian `<script>`). Tidak ada file `.env`.

### Variabel Konfigurasi Utama

| Lokasi (sekitar baris) | Variabel | Nilai Default | Keterangan |
|---|---|---|---|
| ~757 | `API_URL` | URL Google Apps Script | Endpoint backend |
| ~758 | `COOKIE_NAME` | `EFM_SESSION` | Nama cookie sesi |
| ~634 | Radius GPS | `300` (meter) | Batas jarak absensi |
| ~780 | Max foto width | `1024` (px) | Ukuran kompresi foto |
| ~780 | Kualitas foto | `0.75` | Kualitas JPEG (0–1) |

### CSS Variables (Tema Warna)

Didefinisikan di `:root` dalam `<style>`:

```css
:root {
  --navy:   #1E1C43;   /* Warna utama (topbar, tombol) */
  --orange: #E05945;   /* Aksen (tombol CTA, highlight) */
  --bg:     #f0f0f6;   /* Background halaman */
  --white:  #fff;
  --gray:   #64748b;
  --light:  #f8fafc;
  --border: #e2e8f0;
  --green:  #22c55e;   /* Status sukses */
}
```

---

## Alur Penggunaan

### Login

```
Splash Screen
    ↓
Form Login (Kode PIC + PIN 6 digit)
    ↓ POST ke GAS API
Validasi backend
    ↓ sukses
Dashboard
```

Jika login gagal 3× berturut-turut → layar lockout 5 menit aktif.

### Proses Absensi

```
Dashboard → Tombol "Scan"
    ↓
Aktifkan kamera belakang
    ↓
Scan QR code klien → dapat Order ID
    ↓
Cek GPS: ambil koordinat saat ini
    ↓ validasi radius 300m (di backend)
Form absensi:
  - Konfirmasi data klien
  - Upload foto (ambil dari kamera atau galeri)
    ↓ foto dikompresi client-side
    ↓ POST ke GAS API
Absensi tercatat → tampil konfirmasi
```

### Reset PIN

```
Halaman Login → "Lupa PIN"
    ↓
Form reset: masukkan Kode PIC + alasan
    ↓ POST ke GAS API
Admin menerima notifikasi
    ↓ Admin approve
PIN baru dikirim ke pelatih (via admin)
```

---

## Deployment

### Opsi 1: GitHub Pages (Rekomendasi)

1. Push semua file ke branch `main` (atau `gh-pages`).
2. Di repository GitHub: **Settings → Pages → Source → main → / (root)**.
3. Akses: `https://bugarnusantarajaya-berjaya678.github.io/efm-absensi/`

GitHub Pages otomatis menyediakan HTTPS — diperlukan untuk fitur kamera & GPS.

### Opsi 2: Netlify

1. Drag-and-drop folder project ke [netlify.com/drop](https://app.netlify.com/drop).
2. Atau connect repository GitHub → auto-deploy setiap push ke `main`.
3. Custom domain dapat dikonfigurasi di dashboard Netlify.

Tidak perlu konfigurasi build command atau publish directory — langsung deploy as-is.

### Opsi 3: Static Hosting Lainnya

Upload file-file berikut ke web server/hosting manapun yang mendukung HTTPS:

```
index.html
logo-circle-white.png
white-logo-circle-pure.png
```

Tidak perlu konfigurasi server-side, tidak ada `.htaccess` khusus, tidak ada rewrite rules.

### Opsi 4: Self-Hosted (Nginx/Apache)

**Nginx** (minimal config):
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    root /var/www/efm-absensi;
    index index.html;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Apache** (`.htaccess`):
```apache
Options -Indexes
DirectoryIndex index.html
```

---

## Backend (Google Apps Script)

Backend sepenuhnya dikelola via Google Apps Script. Frontend tidak perlu tahu implementasi detailnya — cukup kirim request ke URL endpoint.

### Endpoint

```
https://script.google.com/macros/s/{SCRIPT_ID}/exec
```

### Format Request

Semua request menggunakan `POST` dengan body JSON:

```json
{
  "action": "nama_aksi",
  "token": "session_token",
  "...parameter tambahan": "..."
}
```

### Aksi yang Didukung (action)

| Action | Keterangan |
|---|---|
| `login` | Autentikasi PIC + PIN, return session token |
| `validateSession` | Cek validitas token sesi |
| `logout` | Invalidasi sesi |
| `getDashboard` | Ambil data dashboard (paket aktif, earnings) |
| `getClientByQR` | Lookup data klien dari Order ID QR |
| `submitAbsensi` | Rekam absensi (GPS + foto) |
| `getHistory` | Riwayat sesi per klien |
| `requestPinReset` | Kirim permintaan reset PIN |
| `requestPayment` | Buat permintaan pembayaran dengan tanda tangan |
| `getRecap` | Ambil rekap absensi untuk periode tertentu |

### Mengganti Backend

Untuk mengganti URL backend, ubah konstanta `API_URL` di `index.html`:

```javascript
// Cari baris ~757 di index.html
const API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```

---

## Keamanan

### Mekanisme yang Diimplementasikan

- **PIN lockout:** Akun terkunci 5 menit setelah gagal login berulang kali
- **Session cookie:** `SameSite=Strict` untuk mencegah CSRF
- **GPS enforcement:** Radius 300m divalidasi di sisi server (bukan hanya client)
- **Kompresi foto client-side:** Mengurangi ukuran upload, tidak menyimpan foto mentah
- **PIN numerik 6 digit:** Validasi format di client dan server

### Catatan Keamanan

- PIN numerik 6 digit memiliki entropy yang relatif rendah — pertimbangkan rate limiting ketat di sisi GAS
- Session token disimpan di cookie; pastikan domain produksi menggunakan HTTPS + `Secure` flag
- URL Google Apps Script bersifat publik namun terproteksi oleh token sesi; jangan expose token di log
- Foto tersimpan di Google Drive — pastikan permissions folder Drive dibatasi hanya untuk akun GAS

---

## Kontak & Support

- **Admin WhatsApp:** +62 811-1992-0666
- **Repository:** [github.com/bugarnusantarajaya-berjaya678/efm-absensi](https://github.com/bugarnusantarajaya-berjaya678/efm-absensi)

---

*Dibuat untuk EFM — Elite Fitness Management*
