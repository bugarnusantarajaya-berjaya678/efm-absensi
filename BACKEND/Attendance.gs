// =============================================
// EFM SYSTEM V3 — ATTENDANCE
// Multi-file: getOrderSheet_() untuk query orderan
// =============================================


// =============================================
// INIT SHEET ABSENSI_V2
// =============================================
function initAbsensiSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EFM_CONFIG.ATTENDANCE_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(EFM_CONFIG.ATTENDANCE_SHEET);
    Logger.log("✅ Sheet '" + EFM_CONFIG.ATTENDANCE_SHEET + "' berhasil dibuat!");
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "TIMESTAMP", "ID_ORDER", "KODE_PIC", "NAMA_PIC",
      "PHOTO_URL", "LATITUDE", "LONGITUDE", "DEVICE", "STATUS", "NOTES"
    ]);
    const h = sheet.getRange(1, 1, 1, 10);
    h.setBackground("#1E1C43");
    h.setFontColor("#FFFFFF");
    h.setFontWeight("bold");
    sheet.setFrozenRows(1);
    Logger.log("✅ Header ABSENSI_V2 berhasil dibuat!");
  }

  return sheet;
}


// =============================================
// GET ORDER DATA
// Query ke Database Orderan di SISTEM ORDER PP 2026
// =============================================
function getOrderData(orderId) {

  if (!orderId) return { success: false, message: "Order ID kosong" };

  const sheet    = getOrderSheet_();
  const data     = sheet.getDataRange().getDisplayValues();
  const cfg      = EFM_CONFIG;
  const searchId = clean_(orderId).replace(/\s+/g, "").toUpperCase();

  for (let i = 1; i < data.length; i++) {
    const rowId = clean_(data[i][cfg.COL_ORDER_ID]).replace(/\s+/g, "").toUpperCase();
    if (!rowId || rowId !== searchId) continue;

    // Auto-extract lat/lng dari Google Maps Link
    const gmapsLink = clean_(data[i][cfg.COL_GMAPS_LINK]);
    let latitude = "", longitude = "";
    if (gmapsLink) {
      const parsed = parseGoogleMapsLink(gmapsLink);
      if (parsed.success) {
        latitude  = parsed.latitude;
        longitude = parsed.longitude;
      }
    }

    return {
      success:    true,
      orderId:    rowId,
      namaPIC:    clean_(data[i][cfg.COL_NAMA_PIC])    || "",  // AF — Nama Panggilan PIC
      clientName: clean_(data[i][cfg.COL_CLIENT_NAME]) || "-",
      program:    clean_(data[i][cfg.COL_PROGRAM])     || "-",
      lokasi:     clean_(data[i][cfg.COL_LOKASI])      || "-",
      hari:       clean_(data[i][cfg.COL_HARI])        || "-",
      jam:        clean_(data[i][cfg.COL_JAM])         || "-",
      gmaps_link: gmapsLink,
      latitude:   latitude,
      longitude:  longitude
    };
  }

  return {
    success: false,
    message: "Order ID '" + orderId + "' tidak ditemukan di database"
  };
}


// =============================================
// CHECK DUPLICATE ATTENDANCE
// =============================================
function checkDuplicateAttendance(orderId) {

  if (!orderId) return { duplicate: false };

  const sheet    = getSheet_(EFM_CONFIG.ATTENDANCE_SHEET);
  const data     = sheet.getDataRange().getValues();
  const tz       = Session.getScriptTimeZone();
  const today    = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  const searchId = clean_(orderId).toUpperCase();

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const rowDate  = Utilities.formatDate(new Date(data[i][0]), tz, "yyyy-MM-dd");
    const rowOId   = clean_(data[i][1]).toUpperCase();
    if (rowDate === today && rowOId === searchId) return { duplicate: true };
  }

  return { duplicate: false };
}


// =============================================
// SAVE ATTENDANCE
// =============================================
function saveAttendance(token, kodePIC, namaPIC, orderId, base64Photo, latitude, longitude, device) {

  // 1. Validasi token
  const session = validateToken(token);
  if (!session.valid) {
    return { success: false, message: "Session tidak valid. Silakan login ulang." };
  }

  // 2. Validasi input
  if (!kodePIC)     return { success: false, message: "Kode PIC kosong" };
  if (!namaPIC)     return { success: false, message: "Nama PIC kosong" };
  if (!orderId)     return { success: false, message: "Order ID kosong" };
  if (!base64Photo) return { success: false, message: "Foto wajib diupload" };

  latitude  = latitude  || "";
  longitude = longitude || "";
  device    = device    || "";

  // 3. Validasi status order — tolak jika SELESAI atau BATAL
  try {
    const orderSheet = getOrderSheet_();
    const orderData  = orderSheet.getDataRange().getValues();
    const searchId   = clean_(orderId).toUpperCase().replace(/\s+/g,'');
    let   orderFound = false;
    for (let i = 1; i < orderData.length; i++) {
      const rowId = clean_(orderData[i][EFM_CONFIG.COL_ORDER_ID]).toUpperCase().replace(/\s+/g,'');
      if (rowId !== searchId) continue;
      orderFound = true;
      const statusPaket = clean_(orderData[i][EFM_CONFIG.COL_STATUS_PAKET]).toUpperCase();
      if (statusPaket === EFM_CONFIG.STATUS_SELESAI) {
        return {
          success: false,
          message: '❌ Paket ini sudah SELESAI dan pembayaran telah dilakukan. Barcode tidak berlaku lagi.'
        };
      }
      if (statusPaket === EFM_CONFIG.STATUS_BATAL) {
        return {
          success: false,
          message: '❌ Paket ini telah DIBATALKAN. Barcode tidak berlaku.'
        };
      }
      break; // status AKTIF — lanjut proses
    }
    if (!orderFound) {
      return { success: false, message: '❌ Order ID tidak ditemukan di database.' };
    }
  } catch(e) {
    Logger.log('⚠️ Validasi status order gagal: ' + e.message);
  }

  // 4. Cek duplikat dalam 60 detik (cegah double-submit dari frontend)
  try {
    const absenSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EFM_CONFIG.ATTENDANCE_SHEET);
    if (absenSh && absenSh.getLastRow() > 1) {
      const rows      = absenSh.getDataRange().getValues();
      const now       = new Date().getTime();
      const searchId  = clean_(orderId).toUpperCase();
      const searchPIC = kodePIC.toUpperCase();
      // Cek dari baris terakhir ke atas — berhenti kalau sudah lebih dari 60 detik lalu
      for (let i = rows.length - 1; i >= 1; i--) {
        if (!rows[i][0]) continue;
        const rowTime = new Date(rows[i][0]).getTime();
        if (now - rowTime > 60000) break; // lebih dari 60 detik → aman
        if (clean_(rows[i][1]).toUpperCase() === searchId &&
            clean_(rows[i][2]).toUpperCase() === searchPIC) {
          return { success: false, message: 'Absensi baru saja tercatat. Mohon tunggu 1 menit sebelum mencoba lagi.' };
        }
      }
    }
  } catch(e) { Logger.log('⚠️ Cek duplikat 60 detik gagal: ' + e.message); }

  // 5. Upload foto ke Google Drive
  let photoUrl = "";
  try {
    const folder      = DriveApp.getFolderById(EFM_CONFIG.DRIVE_FOLDER_ID);
    const contentType = base64Photo.match(/^data:(.*);base64,/)[1];
    const bytes       = Utilities.base64Decode(base64Photo.split(",")[1]);
    const fileName    = orderId + "_" + kodePIC + "_" + new Date().getTime() + ".jpg";
    const blob        = Utilities.newBlob(bytes, contentType, fileName);
    const file        = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    photoUrl = file.getUrl();
  } catch(e) {
    return { success: false, message: "Gagal upload foto: " + e.message };
  }

  // 6. Simpan ke ABSENSI_V2
  let sheet;
  try {
    sheet = getSheet_(EFM_CONFIG.ATTENDANCE_SHEET);
  } catch(e) {
    sheet = initAbsensiSheet();
  }

  if (sheet.getLastRow() === 0) initAbsensiSheet();

  const tz        = Session.getScriptTimeZone();
  const timestamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([
    timestamp, orderId, kodePIC, namaPIC,
    photoUrl, latitude, longitude, device, "HADIR", ""
  ]);

  Logger.log("✅ Absensi tersimpan: " + orderId + " | " + kodePIC + " | " + timestamp);

  return {
    success: true,
    message: "Absensi berhasil dicatat! ✅"
  };
}


// =============================================
// PARSE GOOGLE MAPS LINK
// Support berbagai format URL Google Maps
// =============================================
function parseGoogleMapsLink(link) {
  try {
    if (!link) return { success: false, error: 'Link kosong' };
    link = link.trim();

    // Daftar pola koordinat yang dicoba secara berurutan
    const patterns = [
      // 1. Format standar: @lat,lng (paling umum)
      /@(-?\d+\.?\d+),(-?\d+\.?\d+)/,
      // 2. Format saddr=lat,lng (directions link - source)
      /[?&]saddr=(-?\d+\.?\d+),(-?\d+\.?\d+)/,
      // 3. Format daddr=lat,lng (directions link - destination, angka saja)
      /[?&]daddr=(-?\d+\.?\d+),(-?\d+\.?\d+)/,
      // 4. Format q=lat,lng (query koordinat)
      /[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/,
      // 5. Format ll=lat,lng (format lama)
      /[?&]ll=(-?\d+\.?\d+),(-?\d+\.?\d+)/,
      // 6. Format center=lat,lng
      /[?&]center=(-?\d+\.?\d+),(-?\d+\.?\d+)/,
    ];

    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        // Validasi range koordinat (lat: -90..90, lng: -180..180)
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
        // Validasi bukan koordinat 0,0 (tidak valid)
        if (lat === 0 && lng === 0) continue;
        Logger.log('✅ Koordinat ditemukan: ' + lat + ', ' + lng + ' (pattern: ' + pattern + ')');
        return {
          success:   true,
          latitude:  String(lat),
          longitude: String(lng),
          source:    pattern.toString()
        };
      }
    }

    // Tidak ada koordinat ditemukan
    if (link.includes('maps.app.goo.gl')) {
      return {
        success: false,
        error:   'Short link tidak didukung. Gunakan full link dari Google Maps.',
        hint:    'Di Google Maps: Share → salin link panjang yang muncul'
      };
    }

    return {
      success: false,
      error:   'Koordinat tidak ditemukan di link ini. Gunakan link Google Maps yang menampilkan lokasi (bukan arah).',
      hint:    'Buka Google Maps → cari lokasi → klik Share/Bagikan → salin link'
    };

  } catch(e) {
    return { success: false, error: 'Parse error: ' + e.message };
  }
}


// =============================================
// GET DASHBOARD
// Paket ACTIVE + potensi bayaran milik PIC ini
// =============================================
function getDashboard(token, kodePIC) {

  const session = validateToken(token);
  if (!session.valid) return { success: false, message: "Session tidak valid. Silakan login ulang." };
  if (!kodePIC)       return { success: false, message: "Kode PIC kosong" };

  const cfg        = EFM_CONFIG;
  const orderData  = getOrderSheet_().getDataRange().getDisplayValues();
  const activePackets = [];

  for (let i = 1; i < orderData.length; i++) {
    const row = orderData[i];
    if (!clean_(row[cfg.COL_ORDER_ID])) continue;

    const statusPaket = clean_(row[cfg.COL_STATUS_PAKET]).toUpperCase();
    if (statusPaket !== cfg.STATUS_AKTIF) continue;

    const nomorPIC  = clean_(row[cfg.COL_NOMOR_ID_PIC]).toUpperCase();
    const kodeUpper = kodePIC.toUpperCase();
    if (!nomorPIC.includes('/' + kodeUpper + '/') &&
        !nomorPIC.includes('/' + kodeUpper)) continue;

    activePackets.push({
      orderId:      clean_(row[cfg.COL_ORDER_ID]),
      clientName:   clean_(row[cfg.COL_CLIENT_NAME]),
      namaLatihan:  clean_(row[cfg.COL_NAMA_LATIHAN]),
      program:      clean_(row[cfg.COL_PROGRAM]),
      lokasi:       clean_(row[cfg.COL_LOKASI]),
      wilayah:      clean_(row[cfg.COL_WILAYAH]),
      hari:         clean_(row[cfg.COL_HARI]),
      jam:          clean_(row[cfg.COL_JAM]),
      tglMulai:     clean_(row[cfg.COL_TGL_MULAI]),
      tglSelesai:   clean_(row[cfg.COL_TGL_SELESAI]),
      totalSesi:    parseInt(clean_(row[cfg.COL_TOTAL_SESI]))  || 0,
      masaHabis:    clean_(row[cfg.COL_MASA_HABIS]),
      biayaSesi:    parseRp_(row[cfg.COL_BIAYA_SESI]),
      biayaPaket:   parseRp_(row[cfg.COL_BIAYA_PAKET]),
      sesiSelesai:  0
    });
  }

  // Hitung sesi selesai dari ABSENSI_V2
  const sesiCount = {};
  try {
    const absenData = getSheet_(cfg.ATTENDANCE_SHEET).getDataRange().getValues();
    for (let i = 1; i < absenData.length; i++) {
      const row = absenData[i];
      if (!row[0]) continue;
      if (clean_(row[2]) !== kodePIC) continue;
      const oid = clean_(row[1]).toUpperCase();
      sesiCount[oid] = (sesiCount[oid] || 0) + 1;
    }
  } catch(e) { /* sheet kosong */ }

  let totalPotensi = 0;
  activePackets.forEach(p => {
    p.sesiSelesai = sesiCount[p.orderId.toUpperCase()] || 0;
    totalPotensi += p.biayaPaket;
  });

  return {
    success:            true,
    totalActivePackets: activePackets.length,
    totalPotensi:       totalPotensi,
    activePackets:      activePackets
  };
}


// getHistory() → ada di History.gs
