// =============================================
// EFM SYSTEM V3 — AUTH
// Sign Up, Login, Session, Lock, PIN Reset
// =============================================


// =============================================
// SIGN UP
// =============================================
function signUpPIC(kodePIC, pin, confirmPin) {

  kodePIC    = clean_(kodePIC).toUpperCase();
  pin        = clean_(pin);
  confirmPin = clean_(confirmPin);

  if (!kodePIC) return { success: false, message: "Kode PIC wajib diisi." };
  if (!pin)     return { success: false, message: "PIN wajib diisi." };
  if (!/^\d{6}$/.test(pin)) {
    return { success: false, message: "PIN harus 6 digit angka. Contoh: 123456" };
  }
  if (pin !== confirmPin) {
    return { success: false, message: "PIN dan konfirmasi PIN tidak sama. Periksa kembali." };
  }

  const picSheet = getPICSheet_();
  const picData  = picSheet.getDataRange().getDisplayValues();
  const cfg      = EFM_CONFIG;

  let foundRowIndex = -1;
  let picRow        = null;

  for (let i = 1; i < picData.length; i++) {
    if (clean_(picData[i][cfg.COL_KODE_PIC]).toUpperCase() === kodePIC) {
      foundRowIndex = i;
      picRow        = picData[i];
      break;
    }
  }

  if (foundRowIndex === -1) {
    return {
      success: false,
      message: "Kode PIC '" + kodePIC + "' tidak ditemukan.\n\n" +
               "Pastikan:\n• Penulisan KAPITAL semua (contoh: BGS bukan bgs)\n" +
               "• Kode sudah didaftarkan admin EFM\n\nHubungi admin jika kode belum terdaftar."
    };
  }

  const statusPIC = clean_(picRow[cfg.COL_STATUS_PIC]).toLowerCase();
  if (statusPIC === "nonaktif" || statusPIC === "inactive" || statusPIC === "tidak aktif") {
    return { success: false, message: "Akun kamu tidak aktif. Hubungi admin EFM." };
  }

  const existingPIN = clean_(picRow[cfg.COL_PIN]);
  if (existingPIN) {
    return {
      success: false,
      message: "Akun dengan Kode PIC '" + kodePIC + "' sudah terdaftar.\nJika lupa PIN, hubungi admin EFM untuk unlock akun."
    };
  }

  // Simpan PIN sebagai TEXT (format '@') agar leading zero seperti "012345" tidak hilang
  const pinCell = picSheet.getRange(foundRowIndex + 1, cfg.COL_PIN + 1);
  pinCell.setNumberFormat('@').setValue(String(pin));

  const namaPanggil = clean_(picRow[cfg.COL_NAMA_PANGGIL]);
  const nomorID     = clean_(picRow[cfg.COL_PIC_NOMOR_ID]);
  const sessionData = createSession_(kodePIC, namaPanggil);

  // Reset lock jika ada (setelah sign up berhasil)
  resetLoginAttempts_(kodePIC);

  Logger.log("✅ Sign Up berhasil: " + kodePIC + " — " + namaPanggil);

  return {
    success:   true,
    token:     sessionData.token,
    expiredAt: sessionData.expiredAt,
    kodePIC:   kodePIC,
    nama:      namaPanggil,
    nomorID:   nomorID,
    message:   "Akun berhasil dibuat! Selamat datang, " + namaPanggil + "! 🎉"
  };
}


// =============================================
// LOGIN
// =============================================
function loginPIN(kodePIC, pin) {

  kodePIC = clean_(kodePIC).toUpperCase();
  pin     = clean_(pin);

  if (!kodePIC) return { success: false, message: "Kode PIC wajib diisi." };
  if (!pin)     return { success: false, message: "PIN wajib diisi." };

  // Cek lock aktif
  const lockCheck = checkLoginLock_(kodePIC);
  if (lockCheck.locked) return lockCheck;

  // Cari PIC di database
  const picSheet = getPICSheet_();
  const picData  = picSheet.getDataRange().getDisplayValues();
  const cfg      = EFM_CONFIG;
  let picRow     = null;

  for (let i = 1; i < picData.length; i++) {
    if (clean_(picData[i][cfg.COL_KODE_PIC]).toUpperCase() === kodePIC) {
      picRow = picData[i];
      break;
    }
  }

  if (!picRow) {
    return { success: false, message: "Kode PIC tidak ditemukan.\nPastikan penulisan kapital semua." };
  }

  const statusPIC = clean_(picRow[cfg.COL_STATUS_PIC]).toLowerCase();
  if (statusPIC === "nonaktif" || statusPIC === "inactive" || statusPIC === "tidak aktif") {
    return { success: false, message: "Akun kamu tidak aktif. Hubungi admin EFM." };
  }

  // Baca PIN dari sheet — pad dengan leading zero agar "012345" yang tersimpan
  // sebagai angka 12345 (data lama) tetap bisa dicocokkan dengan benar
  const rawPIN    = String(clean_(picRow[cfg.COL_PIN])).trim();
  const storedPIN = rawPIN.padStart(6, '0');
  if (!rawPIN) {   // cek cell kosong dari raw value, BUKAN dari hasil padStart
    return { success: false, message: "Akun belum terdaftar.\nSilakan Sign Up terlebih dahulu." };
  }

  // PIN salah
  if (pin !== storedPIN) {
    const attempt = recordFailedAttempt_(kodePIC);
    if (attempt.locked) {
      return {
        success:         false,
        locked:          true,
        lockedUntil:     attempt.lockedUntil,
        showResetButton: attempt.showResetButton,
        message:         "Terlalu banyak percobaan salah PIN.\nAkun dikunci " + cfg.LOCK_DURATION_MINUTES + " menit."
      };
    }
    return {
      success:         false,
      locked:          false,
      showResetButton: attempt.showResetButton,
      message:         "PIN salah. Sisa percobaan: " + attempt.remaining + "x"
    };
  }

  // PIN benar — reset counter, buat session
  resetLoginAttempts_(kodePIC);

  const namaPanggil = clean_(picRow[cfg.COL_NAMA_PANGGIL]);
  const nomorID     = clean_(picRow[cfg.COL_PIC_NOMOR_ID]);
  const sessionData = createSession_(kodePIC, namaPanggil);

  Logger.log("✅ Login berhasil: " + kodePIC + " — " + namaPanggil);

  return {
    success:   true,
    token:     sessionData.token,
    expiredAt: sessionData.expiredAt,
    kodePIC:   kodePIC,
    nama:      namaPanggil,
    nomorID:   nomorID
  };
}


// =============================================
// REQUEST PIN UNLOCK
// Kirim email ke admin dengan link approve/tolak
// =============================================
function requestPINReset(kodePIC) {

  kodePIC = clean_(kodePIC).toUpperCase();
  if (!kodePIC) return { success: false, message: "Kode PIC kosong" };

  // Cari nama PIC
  const picData = getPICSheet_().getDataRange().getDisplayValues();
  const cfg     = EFM_CONFIG;
  let namaPanggil = kodePIC;

  for (let i = 1; i < picData.length; i++) {
    if (clean_(picData[i][cfg.COL_KODE_PIC]).toUpperCase() === kodePIC) {
      namaPanggil = clean_(picData[i][cfg.COL_NAMA_PANGGIL]) || kodePIC;
      break;
    }
  }

  // Buat request record
  const requestId  = Utilities.getUuid();
  const now        = new Date();
  const tz         = Session.getScriptTimeZone();
  const timestamp  = Utilities.formatDate(now, tz, "dd/MM/yyyy HH:mm");

  const reqData = {
    requestId:  requestId,
    kodePIC:    kodePIC,
    nama:       namaPanggil,
    timestamp:  now.toISOString(),
    status:     "pending"
  };
  PropertiesService.getScriptProperties()
    .setProperty("reset_req_" + kodePIC, JSON.stringify(reqData));

  // Build email
  const approveUrl = cfg.WEB_APP_URL + "?action=adminApproveReset&requestId=" + requestId + "&adminKey=" + cfg.ADMIN_KEY;
  const rejectUrl  = cfg.WEB_APP_URL + "?action=adminRejectReset&requestId="  + requestId + "&adminKey=" + cfg.ADMIN_KEY;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <div style="background:#1E1C43;padding:20px 24px;border-radius:10px 10px 0 0;">
        <h2 style="color:white;margin:0;font-size:18px;">🔐 EFM — Request Unlock Akun</h2>
      </div>
      <div style="background:#f8f9fa;padding:20px 24px;border:1px solid #dee2e6;border-top:none;">
        <table style="width:100%;font-size:15px;">
          <tr><td style="color:#6c757d;padding:4px 0;">Pelatih</td><td><strong>${namaPanggil} (${kodePIC})</strong></td></tr>
          <tr><td style="color:#6c757d;padding:4px 0;">Waktu</td><td>${timestamp} WIB</td></tr>
          <tr><td style="color:#6c757d;padding:4px 0;">Status</td><td><span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:4px;font-size:13px;">Menunggu Approval</span></td></tr>
        </table>
        <p style="margin-top:16px;color:#495057;font-size:14px;">
          Pelatih mengajukan unlock akun karena terlalu banyak percobaan salah PIN.
          Akun akan di-unlock dan pelatih bisa login kembali dengan PIN yang sudah ada.
        </p>
      </div>
      <div style="padding:24px;text-align:center;background:#fff;border:1px solid #dee2e6;border-top:none;border-radius:0 0 10px 10px;">
        <a href="${approveUrl}" style="display:inline-block;background:#1E1C43;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;margin-right:10px;">✅ APPROVE</a>
        <a href="${rejectUrl}"  style="display:inline-block;background:#dc3545;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">❌ TOLAK</a>
        <p style="font-size:11px;color:#aaa;margin-top:16px;">Essential Fitness Management · Sistem Absensi</p>
      </div>
    </div>`;

  try {
    GmailApp.sendEmail(
      cfg.ADMIN_EMAIL,
      '[EFM] Unlock Akun — ' + namaPanggil + ' (' + kodePIC + ')',
      'Request unlock akun dari ' + namaPanggil + '. Buka email versi HTML untuk detail.',
      { htmlBody: htmlBody, name: 'EFM Attendance System' }
    );
    Logger.log('✅ Email unlock request terkirim: ' + kodePIC);
    return { success: true, requestId: requestId, message: 'Request berhasil dikirim ke admin EFM' };
  } catch(e) {
    Logger.log('❌ Gagal kirim email: ' + e.message);
    return { success: false, message: 'Gagal kirim email ke admin. Hubungi admin via WhatsApp.' };
  }
}


// =============================================
// CEK STATUS RESET REQUEST
// Frontend polling setiap 10 detik
// =============================================
function checkResetStatus(requestId) {
  if (!requestId) return { success: false, status: "unknown" };

  const props = PropertiesService.getScriptProperties();
  const all   = props.getKeys();

  for (const key of all) {
    if (!key.startsWith("reset_req_")) continue;
    try {
      const data = JSON.parse(props.getProperty(key));
      if (data.requestId === requestId) {
        return { success: true, status: data.status, kodePIC: data.kodePIC, nama: data.nama };
      }
    } catch(e) {}
  }

  return { success: false, status: "not_found" };
}


// =============================================
// ADMIN APPROVE RESET
// Admin klik link di email → akun di-unlock
// Returns HTML untuk ditampilkan di browser admin
// =============================================
function adminApproveReset(requestId, adminKey) {

  if (adminKey !== EFM_CONFIG.ADMIN_KEY) {
    return { html: '<div style="font-family:Arial;text-align:center;padding:40px;"><h2 style="color:#dc3545;">❌ Admin key tidak valid</h2></div>' };
  }

  const props = PropertiesService.getScriptProperties();
  const all   = props.getKeys();

  for (const key of all) {
    if (!key.startsWith("reset_req_")) continue;
    try {
      const data = JSON.parse(props.getProperty(key));
      if (data.requestId !== requestId) continue;

      const kodePIC = data.kodePIC;
      const nama    = data.nama;

      // Hapus lock di PropertiesService
      props.deleteProperty("lock_" + kodePIC);

      // Update status request → approved
      data.status = "approved";
      data.approvedAt = new Date().toISOString();
      props.setProperty(key, JSON.stringify(data));

      Logger.log("✅ Admin approved unlock: " + kodePIC);

      return {
        html: `<div style="font-family:Arial,sans-serif;text-align:center;padding:40px;max-width:400px;margin:0 auto;">
          <div style="font-size:56px;">✅</div>
          <h2 style="color:#1E1C43;margin:16px 0 8px;">Akun Berhasil Di-unlock!</h2>
          <p style="color:#495057;font-size:15px;"><strong>${nama} (${kodePIC})</strong> sekarang bisa login kembali.</p>
          <p style="font-size:12px;color:#aaa;margin-top:24px;">Essential Fitness Management</p>
        </div>`
      };
    } catch(e) {}
  }

  return {
    html: '<div style="font-family:Arial;text-align:center;padding:40px;"><h2 style="color:#6c757d;">Request tidak ditemukan atau sudah diproses.</h2></div>'
  };
}


// =============================================
// ADMIN REJECT RESET
// =============================================
function adminRejectReset(requestId, adminKey) {

  if (adminKey !== EFM_CONFIG.ADMIN_KEY) {
    return { html: '<div style="font-family:Arial;text-align:center;padding:40px;"><h2 style="color:#dc3545;">❌ Admin key tidak valid</h2></div>' };
  }

  const props = PropertiesService.getScriptProperties();
  const all   = props.getKeys();

  for (const key of all) {
    if (!key.startsWith("reset_req_")) continue;
    try {
      const data = JSON.parse(props.getProperty(key));
      if (data.requestId !== requestId) continue;

      data.status = "rejected";
      data.rejectedAt = new Date().toISOString();
      props.setProperty(key, JSON.stringify(data));

      Logger.log("❌ Admin rejected unlock: " + data.kodePIC);

      return {
        html: `<div style="font-family:Arial,sans-serif;text-align:center;padding:40px;max-width:400px;margin:0 auto;">
          <div style="font-size:56px;">❌</div>
          <h2 style="color:#dc3545;margin:16px 0 8px;">Request Ditolak</h2>
          <p style="color:#495057;font-size:15px;">Request unlock <strong>${data.nama} (${data.kodePIC})</strong> telah ditolak.</p>
          <p style="font-size:12px;color:#aaa;margin-top:24px;">Essential Fitness Management</p>
        </div>`
      };
    } catch(e) {}
  }

  return {
    html: '<div style="font-family:Arial;text-align:center;padding:40px;"><h2 style="color:#6c757d;">Request tidak ditemukan.</h2></div>'
  };
}


// =============================================
// VALIDATE TOKEN
// =============================================
function validateToken(token) {
  if (!token) return { valid: false, message: "Token kosong" };
  try {
    const sheet = getSheet_(EFM_CONFIG.SESSION_SHEET);
    const data  = sheet.getDataRange().getValues();
    const now   = new Date();
    for (let i = 1; i < data.length; i++) {
      if (clean_(data[i][0]) !== token) continue;
      const status    = clean_(data[i][5]).toUpperCase();
      const expiredAt = new Date(data[i][4]);
      if (status !== "ACTIVE")  return { valid: false, message: "Session tidak aktif" };
      if (now > expiredAt)      return { valid: false, message: "Session kadaluarsa. Silakan login ulang." };
      return { valid: true, kodePIC: clean_(data[i][1]), nama: clean_(data[i][2]) };
    }
  } catch(e) { Logger.log("⚠️ validateToken error: " + e.message); }
  return { valid: false, message: "Token tidak ditemukan. Silakan login ulang." };
}


// =============================================
// LOGOUT
// =============================================
function logoutSession(token) {
  if (!token) return { success: false };
  try {
    const sheet = getSheet_(EFM_CONFIG.SESSION_SHEET);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (clean_(data[i][0]) !== token) continue;
      sheet.getRange(i + 1, 6).setValue("EXPIRED");
      return { success: true };
    }
  } catch(e) {}
  return { success: false };
}


// =============================================
// CREATE SESSION (internal)
// =============================================
function createSession_(kodePIC, nama) {
  const cfg       = EFM_CONFIG;
  const token     = Utilities.getUuid();
  const now       = new Date();
  const expiredAt = new Date(now.getTime() + cfg.SESSION_EXPIRE_HOURS * 3600000);
  try {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.SESSION_SHEET);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(cfg.SESSION_SHEET);
      sheet.appendRow(["TOKEN","KODE_PIC","NAMA_PIC","CREATED_AT","EXPIRED_AT","STATUS"]);
      const h = sheet.getRange(1,1,1,6);
      h.setBackground("#1E1C43"); h.setFontColor("#FFFFFF"); h.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([token, kodePIC, nama, now, expiredAt, "ACTIVE"]);
  } catch(e) { Logger.log("⚠️ createSession_ error: " + e.message); }
  return { token, expiredAt: expiredAt.toISOString() };
}


// =============================================
// LOCK MECHANISM — internal helpers
// =============================================
function checkLoginLock_(kodePIC) {
  const props = PropertiesService.getScriptProperties();
  const key   = "lock_" + kodePIC;
  const raw   = props.getProperty(key);
  if (!raw) return { locked: false, showResetButton: false };

  const data  = JSON.parse(raw);
  if (!data.lockedUntil) {
    // Tidak terkunci, tapi cek apakah sudah round 2
    return { locked: false, showResetButton: (data.round || 1) >= 2 };
  }

  const now       = new Date();
  const lockUntil = new Date(data.lockedUntil);

  if (now < lockUntil) {
    const tz         = Session.getScriptTimeZone();
    const unlockTime = Utilities.formatDate(lockUntil, tz, "HH:mm");
    return {
      locked:          true,
      success:         false,
      lockedUntil:     data.lockedUntil,
      showResetButton: (data.round || 1) >= 2,
      message:         "Akun dikunci karena terlalu banyak percobaan salah PIN.\n" +
                       "Coba lagi pukul " + unlockTime + "."
    };
  }

  // Lock sudah expired → hapus lockedUntil, pertahankan round
  data.lockedUntil = null;
  props.setProperty(key, JSON.stringify(data));
  return { locked: false, showResetButton: (data.round || 1) >= 2 };
}

function recordFailedAttempt_(kodePIC) {
  const cfg   = EFM_CONFIG;
  const props = PropertiesService.getScriptProperties();
  const key   = "lock_" + kodePIC;
  const raw   = props.getProperty(key);
  const data  = raw ? JSON.parse(raw) : { count: 0, round: 1, lockedUntil: null };

  data.count += 1;

  if (data.count >= cfg.MAX_LOGIN_ATTEMPTS) {
    const lockUntil  = new Date(new Date().getTime() + cfg.LOCK_DURATION_MINUTES * 60000);
    data.lockedUntil = lockUntil.toISOString();
    data.count       = 0;
    data.round       = (data.round || 1) + 1;
    props.setProperty(key, JSON.stringify(data));
    return {
      remaining:       0,
      locked:          true,
      lockedUntil:     lockUntil.toISOString(),
      showResetButton: data.round >= 2
    };
  }

  props.setProperty(key, JSON.stringify(data));
  return {
    remaining:       cfg.MAX_LOGIN_ATTEMPTS - data.count,
    locked:          false,
    showResetButton: (data.round || 1) >= 2 && data.count >= 1
  };
}

function resetLoginAttempts_(kodePIC) {
  PropertiesService.getScriptProperties().deleteProperty("lock_" + kodePIC);
}
