// =============================================
// EFM SYSTEM V3 — HISTORY
// Baca order dari SISTEM ORDER PP 2026 (external)
// Baca absensi dari ABSENSI_V2 (local)
// =============================================

function getHistory(token, kodePIC) {

  const session = validateToken(token);
  if (!session.valid) return { success: false, message: "Session tidak valid. Silakan login ulang." };
  if (!kodePIC)       return { success: false, message: "Kode PIC kosong" };

  try {
    const cfg = EFM_CONFIG;
    const tz  = Session.getScriptTimeZone();

    // ── 1. Ambil data order — cache dulu, baru external file ──────────
    // CacheService menghindari buka file eksternal setiap request
    // TTL 5 menit — data order jarang berubah
    const CACHE_KEY   = 'EFM_ORDERS_V1';
    const scriptCache = CacheService.getScriptCache();
    let   compactOrders = null;

    // Coba ambil dari cache
    try {
      const cached = scriptCache.get(CACHE_KEY);
      if (cached) {
        compactOrders = JSON.parse(cached);
        Logger.log('✅ History: order dari CACHE (' + compactOrders.length + ' rows)');
      }
    } catch(eCacheRead) {
      Logger.log('⚠️ History: cache read error — ' + eCacheRead.message);
      compactOrders = null; // fallback ke sheet
    }

    // Cache miss → baca dari external file
    if (!compactOrders) {
      let rawData;
      try {
        rawData = getOrderSheet_().getDataRange().getDisplayValues();
        Logger.log('✅ History: order dari SHEET (' + rawData.length + ' rows)');
      } catch(e) {
        Logger.log('❌ History: gagal baca orderData — ' + e.message);
        return { success: false, message: 'Gagal akses Database Orderan: ' + e.message };
      }

      // Kompres ke kolom yang dibutuhkan saja (single-letter key agar muat di 100KB)
      compactOrders = [];
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const oid = String(row[cfg.COL_ORDER_ID] || '').trim();
        if (!oid) continue;
        compactOrders.push({
          a: oid,                                                     // orderId
          b: String(row[cfg.COL_CLIENT_NAME]        || '').trim(),  // clientName
          c: String(row[cfg.COL_NAMA_LATIHAN]        || '').trim(),  // namaLatihan
          d: String(row[cfg.COL_PROGRAM]              || '').trim(),  // program
          e: String(row[cfg.COL_LOKASI]               || '').trim(),  // lokasi
          f: String(row[cfg.COL_WILAYAH]              || '').trim(),  // wilayah
          g: String(row[cfg.COL_HARI]                 || '').trim(),  // hari
          h: String(row[cfg.COL_JAM]                  || '').trim(),  // jam
          i: String(row[cfg.COL_TGL_MULAI]            || '').trim(),  // tglMulai
          j: String(row[cfg.COL_TGL_SELESAI]          || '').trim(),  // tglSelesai
          k: String(row[cfg.COL_STATUS_PAKET]         || '').trim(),  // statusPaket
          l: String(row[cfg.COL_TOTAL_SESI]           || '').trim(),  // totalSesi
          m: String(row[cfg.COL_MASA_HABIS]           || '').trim(),  // masaHabis
          n: String(row[cfg.COL_BIAYA_SESI]           || '').trim(),  // biayaSesi
          o: String(row[cfg.COL_BIAYA_PAKET]          || '').trim(),  // biayaPaket
          p: String(row[cfg.COL_NOMOR_ID_PIC]         || '').trim()   // nomorIdPIC
        });
      }

      // Simpan ke cache (graceful — kalau gagal, tidak masalah)
      try {
        const cacheStr = JSON.stringify(compactOrders);
        scriptCache.put(CACHE_KEY, cacheStr, 300); // 5 menit
        Logger.log('✅ History: disimpan ke cache (' + cacheStr.length + ' chars)');
      } catch(eCacheWrite) {
        Logger.log('⚠️ History: gagal simpan cache — ' + eCacheWrite.message);
      }
    }

    // ── 2. Filter order milik PIC ini ─────────────────────────────────
    const kodeUpper = kodePIC.toUpperCase();
    const picOrders = [];

    for (const o of compactOrders) {
      const nomorPIC = o.p.toUpperCase();
      const match = nomorPIC.includes('/' + kodeUpper + '/') ||
                    nomorPIC.endsWith('/' + kodeUpper);
      if (!match) continue;

      picOrders.push({
        orderId:     o.a.toUpperCase(),
        clientName:  o.b,
        namaLatihan: o.c,
        program:     o.d,
        lokasi:      o.e,
        wilayah:     o.f,
        hari:        o.g,
        jam:         o.h,
        tglMulai:    o.i,
        tglSelesai:  o.j,
        statusPaket: o.k.toUpperCase(),
        totalSesi:   parseInt(o.l) || 0,
        masaHabis:   o.m,
        biayaSesi:   parseRp_(o.n),
        biayaPaket:  parseRp_(o.o)
      });
    }

    Logger.log('✅ History: picOrders=' + picOrders.length + ' untuk kodePIC=' + kodePIC);

    // ── 3. Ambil absensi dari ABSENSI_V2 (lokal — tidak perlu cache) ───
    const sesiPerOrder = {};
    try {
      const ss    = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(cfg.ATTENDANCE_SHEET);

      if (sheet && sheet.getLastRow() > 1) {
        const absenData = sheet.getDataRange().getValues();
        for (let i = 1; i < absenData.length; i++) {
          const row = absenData[i];
          if (!row[0]) continue;
          if (clean_(row[2]).toUpperCase() !== kodePIC.toUpperCase()) continue;

          const oid = clean_(row[1]).toUpperCase();
          if (!sesiPerOrder[oid]) sesiPerOrder[oid] = [];
          sesiPerOrder[oid].push({
            noSesi:    sesiPerOrder[oid].length + 1,
            timestamp: Utilities.formatDate(new Date(row[0]), tz, "dd/MM/yyyy HH:mm"),
            photoUrl:  clean_(row[4]),
            status:    clean_(row[8]) || "HADIR"
          });
        }
        Logger.log('✅ History: sesi loaded untuk ' + Object.keys(sesiPerOrder).length + ' order');
      }
    } catch(e) {
      Logger.log('⚠️ History: gagal baca ABSENSI_V2 — ' + e.message);
    }

    // ── 4. Ambil payment status dari PAYMENT_REQUESTS (lokal) ─────────
    const payStatuses = {};
    try {
      const paySheet = SpreadsheetApp.getActiveSpreadsheet()
                         .getSheetByName(EFM_CONFIG.PAYMENT_SHEET);
      if (paySheet && paySheet.getLastRow() > 1) {
        const payData = paySheet.getDataRange().getValues();
        for (let i = 1; i < payData.length; i++) {
          if (clean_(payData[i][3]).toUpperCase() !== kodePIC.toUpperCase()) continue;
          const oid = clean_(payData[i][2]).toUpperCase();
          payStatuses[oid] = {
            status:         clean_(payData[i][5]),  // F: STATUS
            noRekap:        clean_(payData[i][1]),  // B: NO_REKAP
            pdfApprovedUrl: clean_(payData[i][8])   // I: PDF_APPROVED_URL
          };
        }
      }
    } catch(e) {
      Logger.log('⚠️ History: gagal baca PAYMENT_REQUESTS — ' + e.message);
    }

    // ── 5. Gabungkan semua data ────────────────────────────────────────
    let grandTotalBayaran = 0;
    let grandTotalSesi    = 0;

    const data = picOrders.map(o => {
      const sesiList     = sesiPerOrder[o.orderId] || [];
      const sesiSelesai  = sesiList.length;
      const totalBayaran = sesiSelesai * o.biayaSesi;
      grandTotalBayaran += totalBayaran;
      grandTotalSesi    += sesiSelesai;
      const payInfo = payStatuses[o.orderId] || null;
      return {
        orderId:        o.orderId,
        clientName:     o.clientName,
        namaLatihan:    o.namaLatihan,
        program:        o.program,
        lokasi:         o.lokasi,
        wilayah:        o.wilayah,
        hari:           o.hari,
        jam:            o.jam,
        tglMulai:       o.tglMulai,
        tglSelesai:     o.tglSelesai,
        statusPaket:    o.statusPaket,
        totalSesi:      o.totalSesi,
        masaHabis:      o.masaHabis,
        sesiSelesai:    sesiSelesai,
        biayaSesi:      o.biayaSesi,
        biayaPaket:     o.biayaPaket,
        totalBayaran:   totalBayaran,
        sesiList:       sesiList,
        paymentStatus:      payInfo ? payInfo.status         : null,
        paymentNoRekap:     payInfo ? payInfo.noRekap        : null,
        paymentApprovedUrl: payInfo ? payInfo.pdfApprovedUrl : null
      };
    });

    // Urutan: AKTIF dulu, lalu urutkan sesi selesai terbanyak
    data.sort((a, b) => {
      // Order dianggap aktif hanya jika statusPaket=AKTIF DAN payment belum PAID
      // paymentStatus dibaca fresh (tidak di-cache) sehingga langsung akurat
      const aAktif = a.statusPaket === cfg.STATUS_AKTIF && a.paymentStatus !== 'PAID';
      const bAktif = b.statusPaket === cfg.STATUS_AKTIF && b.paymentStatus !== 'PAID';
      if (aAktif && !bAktif) return -1;
      if (!aAktif && bAktif) return 1;
      return b.sesiSelesai - a.sesiSelesai;
    });

    Logger.log('✅ History: selesai, data=' + data.length + ' paket');

    return {
      success:           true,
      grandTotalSesi:    grandTotalSesi,
      grandTotalBayaran: grandTotalBayaran,
      data:              data
    };

  } catch(e) {
    Logger.log('❌ History: error — ' + e.message);
    return { success: false, message: 'Terjadi error: ' + e.message };
  }
}
