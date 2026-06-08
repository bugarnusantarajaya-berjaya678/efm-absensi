// =============================================================================
// GAS_Endpoints.gs — API Endpoint Handlers EFM Absensi System
// =============================================================================
// Setiap fungsi ep*() menangani satu action dari frontend.
// Semua fungsi menerima params (object) dan mengembalikan plain object (bukan Response).
// buildResponse() di GAS_Main.gs yang membungkus jadi JSON response.
//
// Actions:
//   Public  : login, signUp, requestPINReset, checkResetStatus
//   Protected: validateToken, logout, getDashboard, getOrderData,
//              checkDuplicate, saveAttendance, getHistory,
//              getRekapPreview, submitPaymentRequest
// =============================================================================

// =============================================================================
// PUBLIC ENDPOINTS (tidak perlu token)
// =============================================================================

// -----------------------------------------------------------------------------
// epLogin() — Autentikasi pelatih dengan kodePIC + PIN
//
// Request params:
//   kodePIC (string) — kode identifikasi pelatih
//   pin     (string) — PIN 6 digit
//
// Response success:
//   { success: true, token, kodePIC, namaPanggil, bankName, bankAccount, bankHolder }
// Response error:
//   { success: false, message, locked?, lockUntil? }
// -----------------------------------------------------------------------------
function epLogin(params) {
  const kodePIC = (params.kodePIC || '').trim().toUpperCase();
  const pin     = (params.pin || '').trim();

  if (!kodePIC || !pin) {
    return { success: false, message: 'Kode PIC dan PIN wajib diisi' };
  }
  if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
    return { success: false, message: 'PIN harus ' + PIN_LENGTH + ' digit angka' };
  }

  const user = dbGetUserByKodePIC(kodePIC);
  if (!user) {
    return { success: false, message: 'Kode PIC tidak ditemukan' };
  }

  // Cek lockout
  if (user[COL_USERS.STATUS] === 'locked') {
    const lockedUntil = new Date(user[COL_USERS.LOCKED_UNTIL]);
    if (lockedUntil > new Date()) {
      return {
        success: false,
        message: 'Akun terkunci sementara. Coba lagi setelah ' + LOCKOUT_DURATION_MINUTES + ' menit.',
        locked: true,
        lockUntil: lockedUntil.getTime()
      };
    }
    // Lockout sudah berakhir — reset
    dbResetLoginAttempts(kodePIC);
  }

  if (user[COL_USERS.STATUS] === 'inactive') {
    return { success: false, message: 'Akun tidak aktif. Hubungi admin.' };
  }

  // Verifikasi PIN
  if (!verifyPin(pin, user[COL_USERS.PIN])) {
    const attempts = dbIncrementLoginAttempts(kodePIC);
    const remaining = MAX_LOGIN_ATTEMPTS - attempts;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      dbLockUser(kodePIC, lockUntil);
      return {
        success: false,
        message: 'Terlalu banyak percobaan. Akun dikunci ' + LOCKOUT_DURATION_MINUTES + ' menit.',
        locked: true,
        lockUntil: lockUntil.getTime()
      };
    }
    return {
      success: false,
      message: 'PIN salah. Sisa percobaan: ' + remaining
    };
  }

  // Login sukses — buat session token
  dbResetLoginAttempts(kodePIC);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  dbCreateSession(token, kodePIC, expiresAt);

  return {
    success     : true,
    token       : token,
    kodePIC     : kodePIC,
    namaPanggil : user[COL_USERS.NAMA_PANGGIL],
    namaLengkap : user[COL_USERS.NAMA_LENGKAP],
    bankName    : user[COL_USERS.BANK_NAME]    || '',
    bankAccount : user[COL_USERS.BANK_ACCOUNT] || '',
    bankHolder  : user[COL_USERS.BANK_HOLDER]  || '',
  };
}

// -----------------------------------------------------------------------------
// epSignUp() — Registrasi akun pelatih baru
//
// Request params:
//   kodePIC    (string) — kode PIC yang ingin didaftarkan
//   pin        (string) — PIN 6 digit
//   confirmPin (string) — konfirmasi PIN
//
// Response: { success: true, token, kodePIC, namaPanggil }
// -----------------------------------------------------------------------------
function epSignUp(params) {
  const kodePIC    = (params.kodePIC    || '').trim().toUpperCase();
  const pin        = (params.pin        || '').trim();
  const confirmPin = (params.confirmPin || '').trim();

  if (!kodePIC || !pin || !confirmPin) {
    return { success: false, message: 'Semua field wajib diisi' };
  }
  if (pin !== confirmPin) {
    return { success: false, message: 'PIN dan konfirmasi PIN tidak cocok' };
  }
  if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
    return { success: false, message: 'PIN harus ' + PIN_LENGTH + ' digit angka' };
  }

  // Cek apakah kodePIC sudah terdaftar
  const existing = dbGetUserByKodePIC(kodePIC);
  if (existing) {
    return { success: false, message: 'Kode PIC sudah terdaftar' };
  }

  // Simpan user baru
  const userId = generateId('USR');
  const hashedPin = hashPin(pin);
  dbCreateUser(userId, kodePIC, hashedPin);

  // Buat session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  dbCreateSession(token, kodePIC, expiresAt);

  return {
    success     : true,
    token       : token,
    kodePIC     : kodePIC,
    namaPanggil : kodePIC, // default nama = kodePIC, admin bisa update
  };
}

// -----------------------------------------------------------------------------
// epRequestPINReset() — Kirim permintaan reset PIN ke admin
//
// Request params:
//   kodePIC (string) — kode PIC yang minta reset
//
// Response: { success: true, requestId, message }
// -----------------------------------------------------------------------------
function epRequestPINReset(params) {
  const kodePIC = (params.kodePIC || '').trim().toUpperCase();

  if (!kodePIC) {
    return { success: false, message: 'Kode PIC wajib diisi' };
  }

  const user = dbGetUserByKodePIC(kodePIC);
  if (!user) {
    return { success: false, message: 'Kode PIC tidak ditemukan' };
  }

  const requestId = generateId('PINREQ');
  dbCreatePinResetRequest(requestId, kodePIC);

  // Opsional: kirim notifikasi email ke admin
  // MailApp.sendEmail(ADMIN_EMAIL, '[EFM] PIN Reset Request', 'KodePIC: ' + kodePIC);

  return {
    success   : true,
    requestId : requestId,
    message   : 'Permintaan reset PIN berhasil dikirim. Admin akan menghubungi Anda.'
  };
}

// -----------------------------------------------------------------------------
// epCheckResetStatus() — Cek status permintaan reset PIN
//
// Request params:
//   requestId (string) — ID request yang dikembalikan epRequestPINReset
//
// Response: { success: true, status: 'pending'|'approved'|'rejected', newPin? }
// -----------------------------------------------------------------------------
function epCheckResetStatus(params) {
  const requestId = (params.requestId || '').trim();

  if (!requestId) {
    return { success: false, message: 'Request ID tidak valid' };
  }

  const req = dbGetPinResetRequest(requestId);
  if (!req) {
    return { success: false, message: 'Request tidak ditemukan' };
  }

  const status = req[COL_PIN_REQUESTS.STATUS];
  const result = { success: true, status: status };

  if (status === 'approved') {
    result.newPin = req[COL_PIN_REQUESTS.NEW_PIN];
    result.message = 'PIN Anda telah direset. Gunakan PIN baru untuk login.';
  } else if (status === 'rejected') {
    result.message = 'Permintaan reset PIN ditolak admin. Hubungi admin langsung.';
  } else {
    result.message = 'Menunggu persetujuan admin.';
  }

  return result;
}

// =============================================================================
// PROTECTED ENDPOINTS (memerlukan token valid)
// =============================================================================

// -----------------------------------------------------------------------------
// epValidateToken() — Validasi token session masih aktif
//
// Request params:
//   token (string)
//
// Response: { success: true, kodePIC, namaPanggil, ... }
// -----------------------------------------------------------------------------
function epValidateToken(params) {
  const session = params._session;
  const kodePIC = session[COL_SESSIONS.KODE_PIC];
  const user = dbGetUserByKodePIC(kodePIC);

  if (!user) {
    return { success: false, message: 'User tidak ditemukan', unauthorized: true };
  }

  return {
    success     : true,
    kodePIC     : kodePIC,
    namaPanggil : user[COL_USERS.NAMA_PANGGIL],
    namaLengkap : user[COL_USERS.NAMA_LENGKAP],
    bankName    : user[COL_USERS.BANK_NAME]    || '',
    bankAccount : user[COL_USERS.BANK_ACCOUNT] || '',
    bankHolder  : user[COL_USERS.BANK_HOLDER]  || '',
  };
}

// -----------------------------------------------------------------------------
// epLogout() — Hapus session token
//
// Request params:
//   token (string)
//
// Response: { success: true }
// -----------------------------------------------------------------------------
function epLogout(params) {
  const token = params.token || '';
  dbDeleteSession(token);
  return { success: true };
}

// -----------------------------------------------------------------------------
// epGetDashboard() — Ambil data dashboard: paket aktif & ringkasan earnings
//
// Request params:
//   token   (string)
//   kodePIC (string)
//
// Response: { success: true, packages: [...], totalEarnings, pendingPayment }
// -----------------------------------------------------------------------------
function epGetDashboard(params) {
  const kodePIC = (params.kodePIC || '').trim().toUpperCase();
  const orders  = dbGetActiveOrdersByPIC(kodePIC);

  const packages = orders.map(function(o) {
    return {
      orderId     : o[COL_ORDERS.ORDER_ID],
      clientName  : o[COL_ORDERS.CLIENT_NAME],
      packageName : o[COL_ORDERS.PACKAGE_NAME],
      totalSesi   : o[COL_ORDERS.TOTAL_SESI],
      usedSesi    : o[COL_ORDERS.USED_SESI],
      remainSesi  : o[COL_ORDERS.TOTAL_SESI] - o[COL_ORDERS.USED_SESI],
      price       : o[COL_ORDERS.PRICE],
      status      : o[COL_ORDERS.STATUS],
      expiredAt   : o[COL_ORDERS.EXPIRED_AT],
    };
  });

  // Hitung total potensi earnings dari paket aktif
  const totalEarnings = packages.reduce(function(sum, p) {
    return sum + (p.price || 0);
  }, 0);

  // Cek apakah ada payment pending
  const pendingPayments = dbGetPendingPaymentsByPIC(kodePIC);

  return {
    success        : true,
    packages       : packages,
    totalPackages  : packages.length,
    totalEarnings  : totalEarnings,
    pendingPayment : pendingPayments.length > 0,
  };
}

// -----------------------------------------------------------------------------
// epGetOrderData() — Ambil data klien & paket dari Order ID (hasil scan QR)
//
// Request params:
//   orderId (string) — Order ID dari QR code
//
// Response: { success: true, orderId, clientName, packageName, ... }
// -----------------------------------------------------------------------------
function epGetOrderData(params) {
  const orderId = (params.orderId || '').trim();

  if (!orderId) {
    return { success: false, message: 'Order ID tidak valid' };
  }

  const order = dbGetOrderById(orderId);
  if (!order) {
    return { success: false, message: 'Order ID tidak ditemukan. Pastikan QR code benar.' };
  }

  if (order[COL_ORDERS.STATUS] !== 'active') {
    return { success: false, message: 'Paket ini sudah tidak aktif atau telah selesai.' };
  }

  const totalSesi = Number(order[COL_ORDERS.TOTAL_SESI]);
  const usedSesi  = Number(order[COL_ORDERS.USED_SESI]);
  const remaining = totalSesi - usedSesi;

  if (remaining <= 0) {
    return {
      success     : false,
      message     : 'Semua sesi pada paket ini sudah habis.',
      limitReached: true
    };
  }

  return {
    success     : true,
    orderId     : order[COL_ORDERS.ORDER_ID],
    clientName  : order[COL_ORDERS.CLIENT_NAME],
    packageName : order[COL_ORDERS.PACKAGE_NAME],
    totalSesi   : totalSesi,
    usedSesi    : usedSesi,
    remainSesi  : remaining,
    sesiKe      : usedSesi + 1,
    kodePIC     : order[COL_ORDERS.KODE_PIC],
    gpsLat      : order[COL_ORDERS.GPS_LAT],
    gpsLng      : order[COL_ORDERS.GPS_LNG],
    expiredAt   : order[COL_ORDERS.EXPIRED_AT],
  };
}

// -----------------------------------------------------------------------------
// epCheckDuplicate() — Cek apakah sudah absen untuk Order ID hari ini
//
// Request params:
//   token   (string)
//   orderId (string)
//
// Response: { success: true, duplicate: bool }
// -----------------------------------------------------------------------------
function epCheckDuplicate(params) {
  const orderId = (params.orderId || '').trim();
  const today   = nowDate();

  const existing = dbGetAttendanceByOrderAndDate(orderId, today);
  return {
    success   : true,
    duplicate : existing.length > 0,
  };
}

// -----------------------------------------------------------------------------
// epSaveAttendance() — Simpan absensi sesi latihan
//
// Request params:
//   token      (string)
//   kodePIC    (string)
//   namaPIC    (string)
//   orderId    (string)
//   base64Photo(string) — foto dalam format base64
//   latitude   (string)
//   longitude  (string)
//   device     (string) — user-agent
//
// Response: { success: true, attendanceId, sesiKe, remainSesi }
// -----------------------------------------------------------------------------
function epSaveAttendance(params) {
  const kodePIC    = (params.kodePIC   || '').trim().toUpperCase();
  const namaPIC    = (params.namaPIC   || '').trim();
  const orderId    = (params.orderId   || '').trim();
  const base64Photo= params.base64Photo || '';
  const latitude   = parseFloat(params.latitude  || 0);
  const longitude  = parseFloat(params.longitude || 0);
  const device     = params.device || '';

  // Validasi field wajib
  if (!kodePIC || !orderId || !base64Photo) {
    return { success: false, message: 'Data tidak lengkap. Pastikan foto sudah diambil.' };
  }

  // Ambil data order
  const order = dbGetOrderById(orderId);
  if (!order) {
    return { success: false, message: 'Order ID tidak valid' };
  }

  const totalSesi = Number(order[COL_ORDERS.TOTAL_SESI]);
  const usedSesi  = Number(order[COL_ORDERS.USED_SESI]);

  if (usedSesi >= totalSesi) {
    return { success: false, message: 'Semua sesi sudah habis.', limitReached: true };
  }

  // Validasi GPS (jika order memiliki koordinat GPS)
  const orderLat = parseFloat(order[COL_ORDERS.GPS_LAT] || 0);
  const orderLng = parseFloat(order[COL_ORDERS.GPS_LNG] || 0);
  let gpsDistance = 0;

  if (orderLat && orderLng && latitude && longitude) {
    gpsDistance = calculateDistance(latitude, longitude, orderLat, orderLng);
    if (gpsDistance > GPS_RADIUS_METERS) {
      return {
        success: false,
        message: 'Lokasi Anda terlalu jauh dari lokasi sesi (' + gpsDistance + 'm). Maksimum ' + GPS_RADIUS_METERS + 'm.',
        gpsDistance: gpsDistance
      };
    }
  }

  // Upload foto ke Google Drive
  let photoUrl = '';
  try {
    photoUrl = uploadPhotoToDrive(base64Photo, orderId, kodePIC);
  } catch (err) {
    logError('epSaveAttendance:uploadPhoto', err);
    return { success: false, message: 'Gagal mengupload foto. Coba lagi.' };
  }

  // Simpan record absensi
  const attendanceId = generateId('ATT');
  const sesiKe = usedSesi + 1;

  dbCreateAttendance({
    id         : attendanceId,
    orderId    : orderId,
    clientName : order[COL_ORDERS.CLIENT_NAME],
    kodePIC    : kodePIC,
    namaPIC    : namaPIC,
    sesiKe     : sesiKe,
    date       : nowDate(),
    time       : Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm:ss'),
    gpsLat     : latitude,
    gpsLng     : longitude,
    gpsDistance: gpsDistance,
    photoUrl   : photoUrl,
    device     : device,
    status     : 'valid',
  });

  // Update jumlah sesi terpakai di order
  dbUpdateOrderUsedSesi(orderId, sesiKe);

  // Tandai order selesai jika sesi sudah habis
  if (sesiKe >= totalSesi) {
    dbUpdateOrderStatus(orderId, 'completed');
  }

  return {
    success    : true,
    attendanceId: attendanceId,
    sesiKe     : sesiKe,
    totalSesi  : totalSesi,
    remainSesi : totalSesi - sesiKe,
    photoUrl   : photoUrl,
    message    : 'Absensi sesi ke-' + sesiKe + ' berhasil disimpan!',
  };
}

// -----------------------------------------------------------------------------
// epGetHistory() — Ambil riwayat absensi PIC + status pembayaran
//
// Request params:
//   token   (string)
//   kodePIC (string)
//
// Response: { success: true, history: [...] }
// -----------------------------------------------------------------------------
function epGetHistory(params) {
  const kodePIC = (params.kodePIC || '').trim().toUpperCase();
  const orders  = dbGetAllOrdersByPIC(kodePIC);

  const history = orders.map(function(o) {
    const orderId    = o[COL_ORDERS.ORDER_ID];
    const attendances = dbGetAttendanceByOrder(orderId);
    const payment    = dbGetLatestPaymentByOrder(orderId);

    return {
      orderId      : orderId,
      clientName   : o[COL_ORDERS.CLIENT_NAME],
      packageName  : o[COL_ORDERS.PACKAGE_NAME],
      totalSesi    : o[COL_ORDERS.TOTAL_SESI],
      usedSesi     : o[COL_ORDERS.USED_SESI],
      price        : o[COL_ORDERS.PRICE],
      orderStatus  : o[COL_ORDERS.STATUS],
      expiredAt    : o[COL_ORDERS.EXPIRED_AT],
      sessions     : attendances.map(function(a) {
        return {
          id       : a[COL_ATTENDANCE.ID],
          sesiKe   : a[COL_ATTENDANCE.SESI_KE],
          date     : a[COL_ATTENDANCE.DATE],
          time     : a[COL_ATTENDANCE.TIME],
          photoUrl : a[COL_ATTENDANCE.PHOTO_URL],
          status   : a[COL_ATTENDANCE.STATUS],
        };
      }),
      payment: payment ? {
        id             : payment[COL_PAYMENTS.ID],
        status         : payment[COL_PAYMENTS.STATUS],
        amount         : payment[COL_PAYMENTS.AMOUNT],
        submittedAt    : payment[COL_PAYMENTS.SUBMITTED_AT],
        processedAt    : payment[COL_PAYMENTS.PROCESSED_AT],
        approvedUrl    : payment[COL_PAYMENTS.REKAP_URL],
      } : null,
    };
  });

  return { success: true, history: history };
}

// -----------------------------------------------------------------------------
// epGetRekapPreview() — Ambil data preview rekap sebelum submit pembayaran
//
// Request params:
//   token   (string)
//   kodePIC (string)
//   orderId (string)
//
// Response: { success: true, rekap: { ... } }
// -----------------------------------------------------------------------------
function epGetRekapPreview(params) {
  const kodePIC = (params.kodePIC || '').trim().toUpperCase();
  const orderId = (params.orderId || '').trim();

  const order = dbGetOrderById(orderId);
  if (!order) {
    return { success: false, message: 'Order tidak ditemukan' };
  }

  const user = dbGetUserByKodePIC(kodePIC);
  const attendances = dbGetAttendanceByOrder(orderId);

  return {
    success: true,
    rekap  : {
      orderId     : orderId,
      clientName  : order[COL_ORDERS.CLIENT_NAME],
      packageName : order[COL_ORDERS.PACKAGE_NAME],
      totalSesi   : order[COL_ORDERS.TOTAL_SESI],
      usedSesi    : order[COL_ORDERS.USED_SESI],
      price       : order[COL_ORDERS.PRICE],
      kodePIC     : kodePIC,
      namaPIC     : user ? user[COL_USERS.NAMA_PANGGIL] : kodePIC,
      bankName    : user ? user[COL_USERS.BANK_NAME]    : '',
      bankAccount : user ? user[COL_USERS.BANK_ACCOUNT] : '',
      bankHolder  : user ? user[COL_USERS.BANK_HOLDER]  : '',
      sessions    : attendances.map(function(a) {
        return {
          sesiKe   : a[COL_ATTENDANCE.SESI_KE],
          date     : a[COL_ATTENDANCE.DATE],
          time     : a[COL_ATTENDANCE.TIME],
          photoUrl : a[COL_ATTENDANCE.PHOTO_URL],
        };
      }),
      generatedAt : now(),
    }
  };
}

// -----------------------------------------------------------------------------
// epSubmitPaymentRequest() — Submit permintaan pembayaran dengan tanda tangan
//
// Request params:
//   token           (string)
//   kodePIC         (string)
//   orderId         (string)
//   signatureBase64 (string) — tanda tangan dalam base64 JPEG
//
// Response: { success: true, paymentId, message }
// -----------------------------------------------------------------------------
function epSubmitPaymentRequest(params) {
  const kodePIC         = (params.kodePIC || '').trim().toUpperCase();
  const orderId         = (params.orderId || '').trim();
  const signatureBase64 = params.signatureBase64 || '';

  if (!orderId || !signatureBase64) {
    return { success: false, message: 'Data tidak lengkap' };
  }

  const order = dbGetOrderById(orderId);
  if (!order) {
    return { success: false, message: 'Order tidak ditemukan' };
  }

  // Cek apakah sudah ada payment pending untuk order ini
  const existing = dbGetPendingPaymentByOrder(orderId);
  if (existing) {
    return { success: false, message: 'Sudah ada pengajuan pembayaran yang sedang diproses.' };
  }

  // Upload tanda tangan ke Drive
  let signatureUrl = '';
  try {
    signatureUrl = uploadSignatureToDrive(signatureBase64, orderId, kodePIC);
  } catch (err) {
    logError('epSubmitPaymentRequest:uploadSignature', err);
    return { success: false, message: 'Gagal mengupload tanda tangan.' };
  }

  // Simpan payment request
  const paymentId = generateId('PAY');
  const usedSesi  = Number(order[COL_ORDERS.USED_SESI]);
  const price     = Number(order[COL_ORDERS.PRICE]);

  dbCreatePayment({
    id           : paymentId,
    orderId      : orderId,
    kodePIC      : kodePIC,
    namaPIC      : params.namaPIC || kodePIC,
    totalSesi    : usedSesi,
    amount       : price,
    status       : 'pending',
    signatureUrl : signatureUrl,
    submittedAt  : now(),
  });

  // Notifikasi admin (opsional)
  // MailApp.sendEmail(ADMIN_EMAIL, '[EFM] Payment Request', 'Order: ' + orderId + ', PIC: ' + kodePIC);

  return {
    success  : true,
    paymentId: paymentId,
    message  : 'Pengajuan pembayaran berhasil dikirim. Admin akan memproses dalam 1x24 jam.'
  };
}

// =============================================================================
// HELPER: Upload ke Google Drive
// =============================================================================

// -----------------------------------------------------------------------------
// uploadPhotoToDrive() — Upload foto absensi (base64) ke Google Drive
// -----------------------------------------------------------------------------
function uploadPhotoToDrive(base64, orderId, kodePIC) {
  const folder   = DriveApp.getFolderById(DRIVE_FOLDER_PHOTO_ID);
  const fileName = 'photo_' + orderId + '_' + kodePIC + '_' + new Date().getTime() + '.jpg';

  // Strip data URL prefix jika ada
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const blob = Utilities.newBlob(
    Utilities.base64Decode(cleanBase64),
    'image/jpeg',
    fileName
  );

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getDownloadUrl();
}

// -----------------------------------------------------------------------------
// uploadSignatureToDrive() — Upload tanda tangan (base64) ke Google Drive
// -----------------------------------------------------------------------------
function uploadSignatureToDrive(base64, orderId, kodePIC) {
  const folder   = DriveApp.getFolderById(DRIVE_FOLDER_PHOTO_ID);
  const fileName = 'signature_' + orderId + '_' + kodePIC + '_' + new Date().getTime() + '.jpg';

  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const blob = Utilities.newBlob(
    Utilities.base64Decode(cleanBase64),
    'image/jpeg',
    fileName
  );

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getDownloadUrl();
}
