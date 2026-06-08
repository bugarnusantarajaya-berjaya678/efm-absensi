// =============================================
// EFM SYSTEM V3 — PAYMENT REQUEST
// Flow: Pelatih ajukan → TTD digital → PDF →
//       Email admin (PDF + link konfirmasi) →
//       Admin klik "Payment Done" → status PAID
// =============================================
// PAYMENT_REQUESTS sheet (di EFM LOGIN ATTENDANCE):
// A:TIMESTAMP  B:NO_REKAP    C:ORDER_ID  D:KODE_PIC  E:NAMA_PIC
// F:STATUS     G:PAID_AT     H:NOTES
// I:PDF_APPROVED_URL         J:SIG_BASE64

// ─── INIT SHEET ──────────────────────────────
function initPaymentSheet_() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(EFM_CONFIG.PAYMENT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(EFM_CONFIG.PAYMENT_SHEET);
    sheet.appendRow(['TIMESTAMP','NO_REKAP','ORDER_ID','KODE_PIC',
                     'NAMA_PIC','STATUS','PAID_AT','NOTES',
                     'PDF_APPROVED_URL','SIG_BASE64']);
    const h = sheet.getRange(1,1,1,10);
    h.setBackground('#1E1C43').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('✅ Sheet PAYMENT_REQUESTS berhasil dibuat');
  }
  return sheet;
}

function generateNoRekap_() {
  const sheet = initPaymentSheet_();
  const n     = Math.max(sheet.getLastRow() - 1, 0) + 1;
  const d     = new Date();
  const m     = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][d.getMonth()];
  return 'REK/' + m + '/' + d.getFullYear() + '/' + String(n).padStart(3,'0');
}


// ─── GET REKAP PREVIEW ────────────────────────
// Dipanggil frontend sebelum TTD untuk tampilkan preview
function getRekapPreview(token, kodePIC, orderId) {
  const session = validateToken(token);
  if (!session.valid) return { success: false, message: 'Session tidak valid' };
  if (!orderId)       return { success: false, message: 'Order ID kosong' };

  try {
    const cfg       = EFM_CONFIG;
    const searchId  = orderId.toUpperCase().replace(/\s+/g,'');

    // ── 1. Data Order ──
    const orderSheet = getOrderSheet_();
    const orderData  = orderSheet.getDataRange().getDisplayValues();
    let   orderRow   = null;
    for (let i = 1; i < orderData.length; i++) {
      if (clean_(orderData[i][cfg.COL_ORDER_ID]).toUpperCase().replace(/\s+/g,'') === searchId) {
        orderRow = orderData[i]; break;
      }
    }
    if (!orderRow) return { success: false, message: 'Order tidak ditemukan: ' + orderId };

    // ── 2. Data PIC (bank info + nama lengkap) ──
    const picSheet = getPICSheet_();
    const picData  = picSheet.getDataRange().getDisplayValues();
    let   picRow   = null;
    for (let i = 1; i < picData.length; i++) {
      if (clean_(picData[i][cfg.COL_KODE_PIC]).toUpperCase() === kodePIC.toUpperCase()) {
        picRow = picData[i]; break;
      }
    }

    // ── 3. Data absensi untuk order ini ──
    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const absenSh   = ss.getSheetByName(cfg.ATTENDANCE_SHEET);
    const sesiList  = [];
    if (absenSh && absenSh.getLastRow() > 1) {
      const tz   = Session.getScriptTimeZone();
      const rows = absenSh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        if (clean_(rows[i][1]).toUpperCase() !== searchId)            continue;
        if (clean_(rows[i][2]).toUpperCase() !== kodePIC.toUpperCase()) continue;
        sesiList.push({
          noSesi:    sesiList.length + 1,
          timestamp: Utilities.formatDate(new Date(rows[i][0]), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
          status:    clean_(rows[i][8]) || 'HADIR',
          hasPhoto:  !!(clean_(rows[i][4]))
        });
      }
    }

    const biayaSesi    = parseRp_(orderRow[cfg.COL_BIAYA_SESI]);
    const totalBayaran = sesiList.length * biayaSesi;
    const totalSesi    = parseInt(clean_(orderRow[cfg.COL_TOTAL_SESI])) || 0;

    return {
      success:         true,
      orderId:         clean_(orderRow[cfg.COL_ORDER_ID]),
      namaPendaftar:   clean_(orderRow[cfg.COL_NAMA_PENDAFTAR]),
      namaKlien:       clean_(orderRow[cfg.COL_CLIENT_NAME]),
      hari:            clean_(orderRow[cfg.COL_HARI]),
      jam:             clean_(orderRow[cfg.COL_JAM]),
      lokasi:          clean_(orderRow[cfg.COL_LOKASI]),
      wilayah:         clean_(orderRow[cfg.COL_WILAYAH]),
      namaLatihan:     clean_(orderRow[cfg.COL_NAMA_LATIHAN]),
      namaProgram:     clean_(orderRow[cfg.COL_PROGRAM]),
      totalSesi:       totalSesi,
      masaHabis:       clean_(orderRow[cfg.COL_MASA_HABIS]),
      biayaSesi:       biayaSesi,
      biayaPaket:      parseRp_(orderRow[cfg.COL_BIAYA_PAKET]),
      biayaLainnya:    clean_(orderRow[cfg.COL_BIAYA_LAINNYA]),
      keterangan:      clean_(orderRow[cfg.COL_KET_BIAYA_LAIN]),
      nomorIdPIC:      clean_(orderRow[cfg.COL_NOMOR_ID_PIC]),
      namaPanggilanPIC:clean_(orderRow[cfg.COL_NAMA_PIC]),
      namaLengkapPIC:  clean_(orderRow[cfg.COL_NAMA_LENGKAP_PIC_O]) ||
                       (picRow ? clean_(picRow[cfg.COL_NAMA_LENGKAP]) : ''),
      namaBank:        picRow ? clean_(picRow[cfg.COL_BANK])     : '',
      cabangBank:      picRow ? clean_(picRow[cfg.COL_CABANG])   : '',
      noRekening:      picRow ? clean_(picRow[cfg.COL_REKENING]) : '',
      atasNama:        picRow ? clean_(picRow[cfg.COL_ATAS_NAMA]): '',
      sesiSelesai:     sesiList.length,
      totalBayaran:    totalBayaran,
      sesiList:        sesiList
    };

  } catch(e) {
    Logger.log('❌ getRekapPreview: ' + e.message);
    return { success: false, message: 'Error: ' + e.message };
  }
}


// ─── SUBMIT PAYMENT REQUEST ───────────────────
function submitPaymentRequest(token, kodePIC, orderId, signatureBase64) {
  const session = validateToken(token);
  if (!session.valid)   return { success: false, message: 'Session tidak valid' };
  if (!orderId)         return { success: false, message: 'Order ID kosong' };
  if (!signatureBase64) return { success: false, message: 'Tanda tangan wajib diisi' };

  try {
    const searchId = orderId.toUpperCase().replace(/\s+/g,'');

    // Cek duplikat pengajuan
    const paySheet = initPaymentSheet_();
    if (paySheet.getLastRow() > 1) {
      const payData = paySheet.getDataRange().getValues();
      for (let i = 1; i < payData.length; i++) {
        const rowOId   = clean_(payData[i][2]).toUpperCase().replace(/\s+/g,'');
        const rowKode  = clean_(payData[i][3]).toUpperCase();
        const rowStat  = clean_(payData[i][5]);
        if (rowOId === searchId && rowKode === kodePIC.toUpperCase() && rowStat !== 'REJECTED') {
          return { success: false, message: 'Pengajuan sudah ada dengan status: ' + rowStat };
        }
      }
    }

    // Ambil data lengkap
    const preview = getRekapPreview(token, kodePIC, orderId);
    if (!preview.success) return { success: false, message: 'Gagal ambil data: ' + preview.message };

    if (preview.sesiSelesai === 0) {
      return { success: false, message: 'Belum ada sesi tercatat untuk paket ini' };
    }

    const tz        = Session.getScriptTimeZone();
    const noRekap   = generateNoRekap_();
    const timestamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

    // Simpan ke PAYMENT_REQUESTS — 10 kolom A-J
    paySheet.appendRow([
      timestamp, noRekap, orderId, kodePIC,
      preview.namaLengkapPIC || preview.namaPanggilanPIC,
      'PENDING', '', '',
      '', signatureBase64
    ]);

    // Kirim email ke admin
    let emailSent = false;
    let emailError = '';
    try {
      sendPaymentEmail_({
        noRekap:        noRekap,
        orderId:        orderId,
        kodePIC:        kodePIC,
        namaLengkapPIC: preview.namaLengkapPIC || preview.namaPanggilanPIC,
        namaKlien:      preview.namaKlien,
        sesiSelesai:    preview.sesiSelesai,
        totalBayaran:   preview.totalBayaran
      });
      emailSent = true;
    } catch(e) {
      emailError = e.message;
      Logger.log('❌ Email gagal: ' + e.message);
    }

    Logger.log('✅ Payment request submitted: ' + noRekap + ' | email: ' + (emailSent ? 'OK' : 'GAGAL'));
    return {
      success:   true,
      noRekap:   noRekap,
      emailSent: emailSent,
      message:   emailSent
        ? 'Pengajuan berhasil! Notifikasi sudah dikirim ke admin EFM.'
        : 'Pengajuan tersimpan, tapi email gagal (' + emailError + '). Hubungi admin manual.'
    };

  } catch(e) {
    Logger.log('❌ submitPaymentRequest: ' + e.message);
    return { success: false, message: 'Error: ' + e.message };
  }
}


// ─── ADMIN CONFIRM PAYMENT ────────────────────
function adminConfirmPayment(noRekap, adminKey) {
  if (adminKey !== EFM_CONFIG.ADMIN_KEY) {
    return { html: buildAdminHtml_('❌ Akses Ditolak', 'Kunci admin tidak valid.', '#dc3545') };
  }
  if (!noRekap) {
    return { html: buildAdminHtml_('❌ Error', 'Parameter noRekap tidak ditemukan.', '#dc3545') };
  }

  try {
    const sheet = initPaymentSheet_();
    if (sheet.getLastRow() <= 1) {
      return { html: buildAdminHtml_('❌ Tidak Ditemukan', 'Belum ada data pengajuan.', '#dc3545') };
    }

    const data = sheet.getDataRange().getValues();
    const tz   = Session.getScriptTimeZone();

    for (let i = 1; i < data.length; i++) {
      if (clean_(data[i][1]) !== noRekap) continue;

      const status  = clean_(data[i][5]);
      const namaPIC = clean_(data[i][4]);
      const orderId = clean_(data[i][2]);
      const kodePIC = clean_(data[i][3]);

      if (status === 'PAID') {
        return { html: buildAdminHtml_('⚠️ Sudah Dikonfirmasi',
          'No. Rekap <b>' + noRekap + '</b> sudah berstatus PAID sebelumnya.', '#FFC107') };
      }

      const paidAt = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
      const paidAtFormatted = Utilities.formatDate(new Date(), tz, 'dd MMMM yyyy, HH:mm');

      // 1. Update PAYMENT_REQUESTS → PAID
      sheet.getRange(i+1, 6).setValue('PAID');
      sheet.getRange(i+1, 7).setValue(paidAt);
      Logger.log('✅ Payment PAID: ' + noRekap);

      // 2. Update Database Orderan → SELESAI
      let orderUpdated = false;
      try {
        const orderSheet = getOrderSheet_();
        const orderData  = orderSheet.getDataRange().getValues();
        const searchId   = orderId.toUpperCase().replace(/\s+/g,'');
        for (let j = 1; j < orderData.length; j++) {
          const rowId = clean_(orderData[j][EFM_CONFIG.COL_ORDER_ID]).toUpperCase().replace(/\s+/g,'');
          if (rowId === searchId) {
            orderSheet.getRange(j+1, EFM_CONFIG.COL_STATUS_PAKET + 1).setValue(EFM_CONFIG.STATUS_SELESAI);
            orderUpdated = true;
            Logger.log('✅ Order status → SELESAI: ' + orderId);
            break;
          }
        }
      } catch(e) {
        Logger.log('⚠️ Gagal update order status: ' + e.message);
      }

      // 3. Ambil nama lengkap PIC
      let namaLengkapPIC = namaPIC;
      try {
        const picSheet = getPICSheet_();
        const picData  = picSheet.getDataRange().getValues();
        for (let k = 1; k < picData.length; k++) {
          if (clean_(picData[k][EFM_CONFIG.COL_KODE_PIC]).toUpperCase() === kodePIC.toUpperCase()) {
            namaLengkapPIC = clean_(picData[k][EFM_CONFIG.COL_NAMA_LENGKAP]) || namaPIC;
            break;
          }
        }
      } catch(e) {
        Logger.log('⚠️ Gagal ambil data PIC: ' + e.message);
      }

      // 4. Generate PDF final
      let pdfApprovedUrl = '';
      try {
        const sigBase64 = clean_(data[i][9]);
        pdfApprovedUrl = generateApprovedPdf_(orderId, kodePIC, noRekap, paidAtFormatted, sigBase64, namaLengkapPIC);
        if (pdfApprovedUrl) {
          sheet.getRange(i+1, 9).setValue(pdfApprovedUrl);
          Logger.log('✅ PDF final generated: ' + pdfApprovedUrl);
        }
      } catch(e) {
        Logger.log('⚠️ Gagal generate PDF final: ' + e.message);
      }

      return { html: buildPaymentDoneHtml_(noRekap, namaLengkapPIC, orderId, paidAt, orderUpdated, pdfApprovedUrl) };
    }

    return { html: buildAdminHtml_('❌ Tidak Ditemukan',
      'No. Rekap <b>' + noRekap + '</b> tidak ditemukan di sistem.', '#dc3545') };

  } catch(e) {
    Logger.log('❌ adminConfirmPayment: ' + e.message);
    return { html: '<p>Error: ' + e.message + '</p>' };
  }
}


// ─── GET PAYMENT STATUS ───────────────────────
function getPaymentStatus(token, kodePIC) {
  const session = validateToken(token);
  if (!session.valid) return { success: false, statuses: {} };
  try {
    const sheet = initPaymentSheet_();
    if (sheet.getLastRow() <= 1) return { success: true, statuses: {} };

    const data     = sheet.getDataRange().getValues();
    const statuses = {};
    for (let i = 1; i < data.length; i++) {
      if (clean_(data[i][3]).toUpperCase() !== kodePIC.toUpperCase()) continue;
      const oid = clean_(data[i][2]).toUpperCase();
      statuses[oid] = {
        status:         clean_(data[i][5]),
        noRekap:        clean_(data[i][1]),
        pdfApprovedUrl: clean_(data[i][8])
      };
    }
    return { success: true, statuses: statuses };
  } catch(e) {
    return { success: true, statuses: {} };
  }
}


// ─── PRIVATE: Send Payment Email ─────────────
function sendPaymentEmail_(data) {
  const cfg = EFM_CONFIG;
  const frp = (n) => 'Rp ' + (n||0).toLocaleString('id-ID');
  const approveUrl = cfg.WEB_APP_URL +
    '?action=adminConfirmPayment&noRekap=' + encodeURIComponent(data.noRekap) +
    '&adminKey=' + encodeURIComponent(cfg.ADMIN_KEY);

  const body =
'<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">' +
'<div style="background:#1E1C43;padding:16px 22px;border-radius:8px 8px 0 0;">' +
'<h2 style="color:#fff;margin:0;font-size:17px;">Pengajuan Rekap Absen &amp; Pembayaran</h2>' +
'<p style="color:#aaa;margin:4px 0 0;font-size:12px;">Essential Fitness Management</p></div>' +
'<div style="background:#f9f9f9;padding:20px 22px;border:1px solid #ddd;border-top:none;">' +
'<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">' +
'<tr><td style="padding:5px 0;color:#666;width:38%;">Pelatih</td><td style="font-weight:bold;">' + data.namaLengkapPIC + ' (' + data.kodePIC + ')</td></tr>' +
'<tr><td style="padding:5px 0;color:#666;">Klien</td><td style="font-weight:bold;">' + data.namaKlien + '</td></tr>' +
'<tr><td style="padding:5px 0;color:#666;">Order ID</td><td><code>' + data.orderId + '</code></td></tr>' +
'<tr><td style="padding:5px 0;color:#666;">No. Rekap</td><td><code>' + data.noRekap + '</code></td></tr>' +
'<tr><td style="padding:5px 0;color:#666;">Total Sesi</td><td>' + data.sesiSelesai + ' sesi selesai</td></tr>' +
'<tr><td style="padding:5px 0;color:#666;">Total Bayaran</td><td><strong style="color:#1E1C43;font-size:15px;">' + frp(data.totalBayaran) + '</strong></td></tr>' +
'</table>' +
'<p style="font-size:12px;color:#666;margin-bottom:16px;">Setelah pembayaran ke rekening pelatih dilakukan, klik tombol di bawah untuk konfirmasi:</p>' +
'<div style="text-align:center;margin-bottom:16px;">' +
'<a href="' + approveUrl + '" style="background:#28a745;color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">✅ Pembayaran Berhasil / Payment Done</a></div>' +
'<p style="font-size:11px;color:#aaa;text-align:center;">PDF rekap final akan otomatis digenerate setelah tombol di atas diklik.</p>' +
'</div></div>';

  GmailApp.sendEmail(
    cfg.ADMIN_EMAIL,
    '[EFM] Pengajuan Pembayaran — ' + data.namaLengkapPIC + ' | ' + data.orderId,
    'Pengajuan rekap absen dari ' + data.namaLengkapPIC + '. Buka email HTML untuk detail.',
    { htmlBody: body, name: 'EFM Attendance System' }
  );
  Logger.log('✅ Email terkirim untuk: ' + data.noRekap);
}


// ─── UTILITAS: Kirim Ulang Email ─────────────
function kirimUlangEmail() {
  const noRekap = 'ISI_NO_REKAP_DISINI'; // ← ganti dengan noRekap yang ada di sheet

  try {
    const sheet = initPaymentSheet_();
    if (sheet.getLastRow() <= 1) { Logger.log('❌ Sheet PAYMENT_REQUESTS kosong'); return; }

    const data = sheet.getDataRange().getValues();
    let found  = false;

    for (let i = 1; i < data.length; i++) {
      if (clean_(data[i][1]) !== noRekap) continue;
      found = true;

      const orderId = clean_(data[i][2]);
      const kodePIC = clean_(data[i][3]);
      const namaPIC = clean_(data[i][4]);

      let namaKlien = '—', sesiSelesai = 0, totalBayaran = 0;
      try {
        const orderSheet = getOrderSheet_();
        const orderData  = orderSheet.getDataRange().getDisplayValues();
        const cfg        = EFM_CONFIG;
        const searchId   = orderId.toUpperCase().replace(/\s+/g,'');
        for (let j = 1; j < orderData.length; j++) {
          const rowId = clean_(orderData[j][cfg.COL_ORDER_ID]).toUpperCase().replace(/\s+/g,'');
          if (rowId === searchId) {
            namaKlien = clean_(orderData[j][cfg.COL_CLIENT_NAME]);
            const biayaSesi = parseRp_(orderData[j][cfg.COL_BIAYA_SESI]);
            const absenSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.ATTENDANCE_SHEET);
            if (absenSh && absenSh.getLastRow() > 1) {
              const absen = absenSh.getDataRange().getValues();
              for (let k = 1; k < absen.length; k++) {
                if (clean_(absen[k][1]).toUpperCase() === searchId) sesiSelesai++;
              }
            }
            totalBayaran = sesiSelesai * biayaSesi;
            break;
          }
        }
      } catch(e) { Logger.log('⚠️ Gagal ambil data order: ' + e.message); }

      sendPaymentEmail_({ noRekap, orderId, kodePIC, namaLengkapPIC: namaPIC, namaKlien, sesiSelesai, totalBayaran });
      Logger.log('✅ Email berhasil dikirim ulang untuk: ' + noRekap);
      return;
    }
    if (!found) Logger.log('❌ No. Rekap tidak ditemukan: ' + noRekap);
  } catch(e) {
    Logger.log('❌ kirimUlangEmail error: ' + e.message);
  }
}


// ─── PRIVATE: Admin HTML pages ────────────────
function buildAdminHtml_(title, body, color) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EFM Konfirmasi</title>' +
'<style>html,body{margin:0;padding:0;min-height:100vh;font-family:Arial,sans-serif;background:#1E1C43;display:flex;align-items:center;justify-content:center;padding:16px;}' +
'.card{background:#fff;border-radius:14px;padding:32px 28px;max-width:420px;width:100%;text-align:center;}' +
'h2{font-size:20px;margin-bottom:10px;color:' + color + ';}p{color:#555;font-size:14px;line-height:1.6;}.logo{font-size:12px;color:#aaa;margin-top:20px;}</style></head>' +
'<body><div class="card"><h2>' + title + '</h2><p>' + body + '</p>' +
'<p class="logo">Essential Fitness Management © ' + new Date().getFullYear() + '</p></div></body></html>';
}

function buildPaymentDoneHtml_(noRekap, namaPIC, orderId, paidAt, orderUpdated, pdfApprovedUrl) {
  const dlSection = pdfApprovedUrl
    ? '<a href="' + pdfApprovedUrl + '" target="_blank" style="display:block;background:#1E1C43;color:#fff;text-align:center;padding:14px 20px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:500;margin-top:8px;">Unduh PDF Rekap Final</a>' +
      '<p style="font-size:12px;color:#888;text-align:center;margin-top:8px;">PDF sudah dilengkapi verifikasi admin — simpan sebagai arsip.</p>'
    : '<p style="font-size:13px;color:#aaa;text-align:center;margin-top:8px;">PDF rekap final sedang diproses.</p>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">' +
'<title>EFM Pembayaran</title><style>' +
'html,body{margin:0;padding:0;min-height:100vh;font-family:Arial,sans-serif;background:#1E1C43;display:flex;align-items:flex-start;justify-content:center;}' +
'.wrap{width:100%;max-width:540px;padding:16px;}.card{background:#fff;border-radius:16px;overflow:hidden;}' +
'.top{background:#28a745;padding:28px 20px;text-align:center;}.icon{font-size:64px;line-height:1;margin-bottom:10px;}' +
'.title{color:#fff;font-size:22px;font-weight:500;margin:0 0 4px;}.sub{color:rgba(255,255,255,.85);font-size:14px;margin:0;}' +
'.body{padding:20px;}table{width:100%;border-collapse:collapse;margin-bottom:16px;}' +
'td{padding:10px 0;font-size:15px;border-bottom:1px solid #f0f0f0;}tr:last-child td{border-bottom:none;}' +
'td:first-child{color:#888;width:45%;}td:last-child{font-weight:500;color:#1E1C43;}' +
'.badge{display:inline-block;background:#e8f5e9;color:#1b5e20;border:1px solid #81c784;padding:5px 14px;border-radius:20px;font-size:14px;font-weight:500;}' +
'.step{font-size:15px;font-weight:500;color:#1E1C43;margin:4px 0 8px;}' +
'.foot{background:#f8f9fa;padding:12px 20px;font-size:12px;color:#aaa;text-align:center;}' +
'</style></head><body><div class="wrap"><div class="card">' +
'<div class="top"><div class="icon">✅</div><p class="title">Pembayaran Dikonfirmasi!</p>' +
'<p class="sub">Status paket otomatis diperbarui ke SELESAI</p></div>' +
'<div class="body"><table>' +
'<tr><td>No. Rekap</td><td>' + noRekap + '</td></tr>' +
'<tr><td>Pelatih</td><td>' + namaPIC + '</td></tr>' +
'<tr><td>Order ID</td><td>' + orderId + '</td></tr>' +
'<tr><td>Waktu</td><td>' + paidAt + '</td></tr>' +
'<tr><td>Status Bayar</td><td><span class="badge">✅ LUNAS</span></td></tr>' +
'<tr><td>Status Paket</td><td><span class="badge">' + (orderUpdated ? '✅ SELESAI' : '⚠️ Cek Manual') + '</span></td></tr>' +
'</table><p class="step">📄 Rekap Absen Final:</p>' + dlSection + '</div>' +
'<div class="foot">Halaman ini bisa ditutup atau disimpan · Essential Fitness Management © ' + new Date().getFullYear() + '</div>' +
'</div></div></body></html>';
}


// ─── PRIVATE: Generate PDF final via Sheets template ──
function generateApprovedPdf_(orderId, kodePIC, noRekap, paidAtFormatted, sigBase64, namaLengkapPIC) {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const cfg      = EFM_CONFIG;
  const tz       = Session.getScriptTimeZone();
  const searchId = orderId.toUpperCase().replace(/\s+/g,'');
  const tempName = 'REKAP_TEMP_' + Date.now();
  let   tempSheet = null;

  try {
    const parts      = (paidAtFormatted || '').split(', ');
    const tglApprove = parts[0] || '';
    const jamApprove = parts[1] || '';

    const orderSheet = getOrderSheet_();
    const orderData  = orderSheet.getDataRange().getDisplayValues();
    let   orderRow   = null;
    for (let i = 1; i < orderData.length; i++) {
      if (clean_(orderData[i][cfg.COL_ORDER_ID]).toUpperCase().replace(/\s+/g,'') === searchId) {
        orderRow = orderData[i]; break;
      }
    }
    if (!orderRow) throw new Error('Order tidak ditemukan: ' + orderId);

    const picSheet = getPICSheet_();
    const picData  = picSheet.getDataRange().getValues();
    let   picRow   = null;
    for (let i = 1; i < picData.length; i++) {
      if (clean_(picData[i][cfg.COL_KODE_PIC]).toUpperCase() === kodePIC.toUpperCase()) {
        picRow = picData[i]; break;
      }
    }

    const sesiList = [];
    const absenSh  = ss.getSheetByName(cfg.ATTENDANCE_SHEET);
    if (absenSh && absenSh.getLastRow() > 1) {
      const rows = absenSh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        if (clean_(rows[i][1]).toUpperCase() !== searchId)             continue;
        if (clean_(rows[i][2]).toUpperCase() !== kodePIC.toUpperCase()) continue;
        sesiList.push({
          no:       sesiList.length + 1,
          ts:       Utilities.formatDate(new Date(rows[i][0]), tz, 'EEEE, dd MMMM yyyy  |  HH:mm'),
          status:   clean_(rows[i][8]) || 'HADIR',
          photoUrl: clean_(rows[i][4])
        });
      }
    }

    const frp        = (n) => 'Rp ' + (n||0).toLocaleString('id-ID');
    const biayaSesi  = parseRp_(orderRow[cfg.COL_BIAYA_SESI]);
    const biayaPaket = parseRp_(orderRow[cfg.COL_BIAYA_PAKET]);
    const totalBayar = sesiList.length * biayaSesi;

    const tmplSheet = ss.getSheetByName(cfg.REKAP_SHEET);
    if (!tmplSheet) throw new Error('Sheet "' + cfg.REKAP_SHEET + '" tidak ditemukan');
    tempSheet = tmplSheet.copyTo(ss);
    tempSheet.setName(tempName);

    const sv = (cell, val) => tempSheet.getRange(cell).setValue(val);

    sv('C5', noRekap);
    sv('E7',  clean_(orderRow[cfg.COL_ORDER_ID]));
    sv('E8',  clean_(orderRow[cfg.COL_NAMA_PENDAFTAR]));
    sv('E9',  clean_(orderRow[cfg.COL_CLIENT_NAME]));
    sv('E10', clean_(orderRow[cfg.COL_HARI]));
    sv('E11', clean_(orderRow[cfg.COL_JAM]));
    sv('E12', clean_(orderRow[cfg.COL_LOKASI]));
    sv('E14', clean_(orderRow[cfg.COL_NOMOR_ID_PIC]));
    sv('E15', clean_(orderRow[cfg.COL_NAMA_PIC]));
    sv('L7',  namaLengkapPIC || clean_(orderRow[cfg.COL_NAMA_LENGKAP_PIC_O]));
    sv('L8',  clean_(orderRow[cfg.COL_NAMA_LATIHAN]));
    sv('L9',  clean_(orderRow[cfg.COL_PROGRAM]));
    sv('L10', clean_(orderRow[cfg.COL_TOTAL_SESI]) + ' Sesi');
    sv('L11', frp(biayaSesi));
    sv('L12', frp(biayaPaket));
    sv('L13', clean_(orderRow[cfg.COL_BIAYA_LAINNYA]) || 'Rp 0');
    sv('L14', clean_(orderRow[cfg.COL_KET_BIAYA_LAIN]) || '—');

    const maxSesi = Math.min(sesiList.length, 32);
    for (let i = 0; i < maxSesi; i++) {
      const row = 18 + i;
      const s   = sesiList[i];
      tempSheet.getRange('B' + row).setValue(s.no);
      tempSheet.getRange('C' + row).setValue('Sesi Ke-' + s.no);
      tempSheet.getRange('E' + row).setValue(s.ts);
      tempSheet.getRange('I' + row).setValue(s.status);
      if (s.photoUrl) tempSheet.getRange('J' + row).setValue(s.photoUrl);
    }
    if (maxSesi > 0) tempSheet.getRange('J18:J' + (17 + maxSesi)).setFontSize(6).setWrap(true);
    if (maxSesi < 32) {
      const firstEmpty = 18 + maxSesi;
      const countHide  = 49 - firstEmpty + 1;
      if (countHide > 0) tempSheet.hideRows(firstEmpty, countHide);
    }

    sv('D52', frp(totalBayar));
    sv('D53', picRow ? clean_(picRow[cfg.COL_BANK])     : '');
    sv('D54', picRow ? clean_(picRow[cfg.COL_CABANG])   : '');
    sv('D55', picRow ? clean_(picRow[cfg.COL_REKENING]) : '');
    sv('D57', picRow ? clean_(picRow[cfg.COL_ATAS_NAMA]): '');
    sv('L53', 'Admin EFM');
    sv('L55', tglApprove + ',  Jam ' + jamApprove);

    const namaPICFull = namaLengkapPIC || clean_(orderRow[cfg.COL_NAMA_LENGKAP_PIC_O]) || clean_(orderRow[cfg.COL_NAMA_PIC]);
    tempSheet.getRange('G55').setValue(namaPICFull);
    tempSheet.getRange('G55:J55').setHorizontalAlignment('center').setVerticalAlignment('middle');

    tempSheet.getRange('L5:M5')
      .setBackground('#1b5e20').setFontColor('#FFFFFF').setFontWeight('bold')
      .setFontSize(12).setHorizontalAlignment('center').setVerticalAlignment('middle');
    tempSheet.getRange('L5').setValue('✅  LUNAS');

    if (sigBase64) {
      try {
        const b64      = sigBase64.indexOf(',') >= 0 ? sigBase64.split(',')[1] : sigBase64;
        const imgBytes = Utilities.base64Decode(b64);
        const imgBlob  = Utilities.newBlob(imgBytes, 'image/jpeg', 'ttd.jpg');
        const ttdImg   = tempSheet.insertImage(imgBlob, 7, 52);
        ttdImg.setWidth(165); ttdImg.setHeight(75);
        ttdImg.setAnchorCellXOffset(4); ttdImg.setAnchorCellYOffset(4);
      } catch(eImg) { Logger.log('⚠️ Insert TTD gagal: ' + eImg.message); }
    }

    SpreadsheetApp.flush();
    Utilities.sleep(2000);

    const ssId      = ss.getId();
    const sheetGid  = tempSheet.getSheetId();
    const exportUrl = 'https://docs.google.com/spreadsheets/d/' + ssId +
      '/export?format=pdf&gid=' + sheetGid +
      '&size=A4&portrait=true&fitw=true&gridlines=false' +
      '&printtitle=false&sheetnames=false&pagenumbers=false' +
      '&top_margin=0.40&bottom_margin=0.40&left_margin=0.40&right_margin=0.40&attachment=true';

    const pdfBlob = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }).getBlob();

    const fname = 'Rekap_' + noRekap.replace(/\//g,'-') + '_' + orderId + '.pdf';
    pdfBlob.setName(fname);

    const folder  = DriveApp.getFolderById(cfg.REKAP_FOLDER_ID);
    const pdfFile = folder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    ss.deleteSheet(tempSheet);
    tempSheet = null;

    Logger.log('✅ PDF rekap berhasil: ' + pdfFile.getName());
    return pdfFile.getUrl();

  } catch(e) {
    Logger.log('❌ generateApprovedPdf_: ' + e.message);
    if (tempSheet) { try { ss.deleteSheet(tempSheet); } catch(e2) {} }
    return '';
  }
}
