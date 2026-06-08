// =============================================================================
// GAS_Database.gs — Database Layer (Google Sheets CRUD)
// =============================================================================
// Semua operasi baca/tulis ke Google Sheets ada di file ini.
// Fungsi-fungsi ini dipanggil oleh GAS_Endpoints.gs.
//
// Konvensi penamaan:
//   dbGet*    — baca data (SELECT)
//   dbCreate* — tambah baris baru (INSERT)
//   dbUpdate* — update baris (UPDATE)
//   dbDelete* — hapus baris (DELETE)
// =============================================================================

// -----------------------------------------------------------------------------
// Helper: buka sheet berdasarkan nama
// -----------------------------------------------------------------------------
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" tidak ditemukan');
  return sheet;
}

// -----------------------------------------------------------------------------
// Helper: ambil semua data sheet sebagai array 2D (skip header row)
// -----------------------------------------------------------------------------
function getAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // hanya header
  return data.slice(1); // skip row pertama (header)
}

// -----------------------------------------------------------------------------
// Helper: cari row index berdasarkan nilai di kolom tertentu (1-indexed, include header)
// -----------------------------------------------------------------------------
function findRowIndex(sheetName, colIndex, value) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]).trim() === String(value).trim()) {
      return i + 1; // Google Sheets row number (1-indexed)
    }
  }
  return -1;
}

// =============================================================================
// USERS
// =============================================================================

function dbGetUserByKodePIC(kodePIC) {
  const rows = getAllRows(SHEETS.USERS);
  return rows.find(function(r) {
    return String(r[COL_USERS.KODE_PIC]).trim().toUpperCase() === kodePIC.toUpperCase();
  }) || null;
}

function dbCreateUser(id, kodePIC, hashedPin) {
  const sheet = getSheet(SHEETS.USERS);
  const row = new Array(12).fill('');
  row[COL_USERS.ID]            = id;
  row[COL_USERS.KODE_PIC]      = kodePIC;
  row[COL_USERS.NAMA_PANGGIL]  = kodePIC;
  row[COL_USERS.NAMA_LENGKAP]  = '';
  row[COL_USERS.PIN]           = hashedPin;
  row[COL_USERS.STATUS]        = 'active';
  row[COL_USERS.LOGIN_ATTEMPT] = 0;
  row[COL_USERS.LOCKED_UNTIL]  = '';
  row[COL_USERS.CREATED_AT]    = now();
  sheet.appendRow(row);
}

function dbIncrementLoginAttempts(kodePIC) {
  const rowIdx = findRowIndex(SHEETS.USERS, COL_USERS.KODE_PIC, kodePIC);
  if (rowIdx < 0) return 0;
  const sheet  = getSheet(SHEETS.USERS);
  const current = sheet.getRange(rowIdx, COL_USERS.LOGIN_ATTEMPT + 1).getValue() || 0;
  const next = Number(current) + 1;
  sheet.getRange(rowIdx, COL_USERS.LOGIN_ATTEMPT + 1).setValue(next);
  return next;
}

function dbResetLoginAttempts(kodePIC) {
  const rowIdx = findRowIndex(SHEETS.USERS, COL_USERS.KODE_PIC, kodePIC);
  if (rowIdx < 0) return;
  const sheet = getSheet(SHEETS.USERS);
  sheet.getRange(rowIdx, COL_USERS.LOGIN_ATTEMPT + 1).setValue(0);
  sheet.getRange(rowIdx, COL_USERS.STATUS + 1).setValue('active');
  sheet.getRange(rowIdx, COL_USERS.LOCKED_UNTIL + 1).setValue('');
}

function dbLockUser(kodePIC, lockedUntil) {
  const rowIdx = findRowIndex(SHEETS.USERS, COL_USERS.KODE_PIC, kodePIC);
  if (rowIdx < 0) return;
  const sheet = getSheet(SHEETS.USERS);
  sheet.getRange(rowIdx, COL_USERS.STATUS + 1).setValue('locked');
  sheet.getRange(rowIdx, COL_USERS.LOCKED_UNTIL + 1).setValue(lockedUntil.toISOString());
}

// =============================================================================
// SESSIONS
// =============================================================================

function dbGetSession(token) {
  const rows = getAllRows(SHEETS.SESSIONS);
  const session = rows.find(function(r) {
    return String(r[COL_SESSIONS.TOKEN]).trim() === token;
  });
  if (!session) return null;

  // Cek kadaluarsa
  const expiresAt = new Date(session[COL_SESSIONS.EXPIRES_AT]);
  if (expiresAt < new Date()) {
    dbDeleteSession(token); // auto cleanup
    return null;
  }
  return session;
}

function dbCreateSession(token, kodePIC, expiresAt) {
  const sheet = getSheet(SHEETS.SESSIONS);
  sheet.appendRow([
    token,
    kodePIC,
    now(),
    expiresAt.toISOString(),
    '',
  ]);
}

function dbDeleteSession(token) {
  const rowIdx = findRowIndex(SHEETS.SESSIONS, COL_SESSIONS.TOKEN, token);
  if (rowIdx > 0) getSheet(SHEETS.SESSIONS).deleteRow(rowIdx);
}

// =============================================================================
// ORDERS
// =============================================================================

function dbGetOrderById(orderId) {
  const rows = getAllRows(SHEETS.ORDERS);
  return rows.find(function(r) {
    return String(r[COL_ORDERS.ORDER_ID]).trim() === orderId.trim();
  }) || null;
}

function dbGetActiveOrdersByPIC(kodePIC) {
  const rows = getAllRows(SHEETS.ORDERS);
  return rows.filter(function(r) {
    return String(r[COL_ORDERS.KODE_PIC]).trim().toUpperCase() === kodePIC &&
           String(r[COL_ORDERS.STATUS]).trim() === 'active';
  });
}

function dbGetAllOrdersByPIC(kodePIC) {
  const rows = getAllRows(SHEETS.ORDERS);
  return rows.filter(function(r) {
    return String(r[COL_ORDERS.KODE_PIC]).trim().toUpperCase() === kodePIC;
  });
}

function dbUpdateOrderUsedSesi(orderId, newUsedSesi) {
  const rowIdx = findRowIndex(SHEETS.ORDERS, COL_ORDERS.ORDER_ID, orderId);
  if (rowIdx < 0) return;
  getSheet(SHEETS.ORDERS).getRange(rowIdx, COL_ORDERS.USED_SESI + 1).setValue(newUsedSesi);
}

function dbUpdateOrderStatus(orderId, status) {
  const rowIdx = findRowIndex(SHEETS.ORDERS, COL_ORDERS.ORDER_ID, orderId);
  if (rowIdx < 0) return;
  getSheet(SHEETS.ORDERS).getRange(rowIdx, COL_ORDERS.STATUS + 1).setValue(status);
}

// =============================================================================
// ATTENDANCE
// =============================================================================

function dbCreateAttendance(data) {
  const sheet = getSheet(SHEETS.ATTENDANCE);
  const row = new Array(15).fill('');
  row[COL_ATTENDANCE.ID]           = data.id;
  row[COL_ATTENDANCE.ORDER_ID]     = data.orderId;
  row[COL_ATTENDANCE.CLIENT_NAME]  = data.clientName;
  row[COL_ATTENDANCE.KODE_PIC]     = data.kodePIC;
  row[COL_ATTENDANCE.NAMA_PIC]     = data.namaPIC;
  row[COL_ATTENDANCE.SESI_KE]      = data.sesiKe;
  row[COL_ATTENDANCE.DATE]         = data.date;
  row[COL_ATTENDANCE.TIME]         = data.time;
  row[COL_ATTENDANCE.GPS_LAT]      = data.gpsLat;
  row[COL_ATTENDANCE.GPS_LNG]      = data.gpsLng;
  row[COL_ATTENDANCE.GPS_DISTANCE] = data.gpsDistance;
  row[COL_ATTENDANCE.PHOTO_URL]    = data.photoUrl;
  row[COL_ATTENDANCE.DEVICE]       = data.device;
  row[COL_ATTENDANCE.STATUS]       = data.status;
  row[COL_ATTENDANCE.PAYMENT_ID]   = '';
  sheet.appendRow(row);
}

function dbGetAttendanceByOrder(orderId) {
  const rows = getAllRows(SHEETS.ATTENDANCE);
  return rows.filter(function(r) {
    return String(r[COL_ATTENDANCE.ORDER_ID]).trim() === orderId;
  }).sort(function(a, b) {
    return a[COL_ATTENDANCE.SESI_KE] - b[COL_ATTENDANCE.SESI_KE];
  });
}

function dbGetAttendanceByOrderAndDate(orderId, date) {
  const rows = getAllRows(SHEETS.ATTENDANCE);
  return rows.filter(function(r) {
    return String(r[COL_ATTENDANCE.ORDER_ID]).trim() === orderId &&
           String(r[COL_ATTENDANCE.DATE]).trim() === date;
  });
}

// =============================================================================
// PAYMENTS
// =============================================================================

function dbCreatePayment(data) {
  const sheet = getSheet(SHEETS.PAYMENTS);
  const row = new Array(12).fill('');
  row[COL_PAYMENTS.ID]           = data.id;
  row[COL_PAYMENTS.ORDER_ID]     = data.orderId;
  row[COL_PAYMENTS.KODE_PIC]     = data.kodePIC;
  row[COL_PAYMENTS.NAMA_PIC]     = data.namaPIC;
  row[COL_PAYMENTS.TOTAL_SESI]   = data.totalSesi;
  row[COL_PAYMENTS.AMOUNT]       = data.amount;
  row[COL_PAYMENTS.STATUS]       = data.status;
  row[COL_PAYMENTS.SIGNATURE_URL]= data.signatureUrl;
  row[COL_PAYMENTS.REKAP_URL]    = '';
  row[COL_PAYMENTS.SUBMITTED_AT] = data.submittedAt;
  row[COL_PAYMENTS.PROCESSED_AT] = '';
  row[COL_PAYMENTS.ADMIN_NOTE]   = '';
  sheet.appendRow(row);
}

function dbGetLatestPaymentByOrder(orderId) {
  const rows = getAllRows(SHEETS.PAYMENTS);
  const payments = rows.filter(function(r) {
    return String(r[COL_PAYMENTS.ORDER_ID]).trim() === orderId;
  });
  if (!payments.length) return null;
  // Kembalikan yang paling baru
  return payments[payments.length - 1];
}

function dbGetPendingPaymentByOrder(orderId) {
  const rows = getAllRows(SHEETS.PAYMENTS);
  return rows.find(function(r) {
    return String(r[COL_PAYMENTS.ORDER_ID]).trim() === orderId &&
           String(r[COL_PAYMENTS.STATUS]).trim() === 'pending';
  }) || null;
}

function dbGetPendingPaymentsByPIC(kodePIC) {
  const rows = getAllRows(SHEETS.PAYMENTS);
  return rows.filter(function(r) {
    return String(r[COL_PAYMENTS.KODE_PIC]).trim().toUpperCase() === kodePIC &&
           String(r[COL_PAYMENTS.STATUS]).trim() === 'pending';
  });
}

// =============================================================================
// PIN RESET REQUESTS
// =============================================================================

function dbCreatePinResetRequest(requestId, kodePIC) {
  const sheet = getSheet(SHEETS.PIN_REQUESTS);
  sheet.appendRow([
    requestId,
    kodePIC,
    'pending',
    '',   // reason
    '',   // new PIN (diisi admin)
    now(),
    '',   // processed_at
  ]);
}

function dbGetPinResetRequest(requestId) {
  const rows = getAllRows(SHEETS.PIN_REQUESTS);
  return rows.find(function(r) {
    return String(r[COL_PIN_REQUESTS.ID]).trim() === requestId;
  }) || null;
}
