// =============================================================================
// GAS_Main.gs — Entry Point EFM Absensi System
// =============================================================================
// File ini adalah entry point utama Google Apps Script.
// Semua HTTP request masuk melalui doGet() dan doPost().
// Router mendistribusikan request ke handler di GAS_Endpoints.gs.
// =============================================================================

// -----------------------------------------------------------------------------
// doGet() — Handle GET requests (validasi token, cek status, dll)
// -----------------------------------------------------------------------------
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || '';

    // Hanya aksi read-only yang diizinkan via GET
    const allowedGetActions = [
      'validateToken',
      'checkResetStatus',
      'checkDuplicate',
      'getOrderData',
    ];

    if (!allowedGetActions.includes(action)) {
      return buildResponse({ success: false, message: 'Method not allowed for this action' }, 405);
    }

    const result = routeRequest(action, params);
    return buildResponse(result);

  } catch (err) {
    logError('doGet', err);
    return buildResponse({ success: false, message: 'Internal server error' }, 500);
  }
}

// -----------------------------------------------------------------------------
// doPost() — Handle POST requests (login, saveAttendance, dll)
// -----------------------------------------------------------------------------
function doPost(e) {
  try {
    let params = {};

    // Parse body — bisa JSON string atau form data
    if (e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (_) {
        params = e.parameter || {};
      }
    } else {
      params = e.parameter || {};
    }

    const action = params.action || '';

    if (!action) {
      return buildResponse({ success: false, message: 'Parameter "action" wajib diisi' }, 400);
    }

    const result = routeRequest(action, params);
    return buildResponse(result);

  } catch (err) {
    logError('doPost', err);
    return buildResponse({ success: false, message: 'Internal server error' }, 500);
  }
}

// -----------------------------------------------------------------------------
// routeRequest() — Router utama: mendistribusikan action ke endpoint handler
// -----------------------------------------------------------------------------
function routeRequest(action, params) {
  // Endpoint yang tidak memerlukan autentikasi
  const publicActions = ['login', 'signUp', 'requestPINReset', 'checkResetStatus'];

  // Endpoint yang memerlukan token valid
  const protectedActions = [
    'validateToken',
    'logout',
    'getDashboard',
    'getOrderData',
    'checkDuplicate',
    'saveAttendance',
    'getHistory',
    'getRekapPreview',
    'submitPaymentRequest',
  ];

  // Validasi token untuk protected actions
  if (protectedActions.includes(action)) {
    const token = params.token || '';
    if (!token) {
      return { success: false, message: 'Token tidak ditemukan. Silakan login ulang.', unauthorized: true };
    }
    const session = dbGetSession(token);
    if (!session) {
      return { success: false, message: 'Sesi tidak valid atau sudah kadaluarsa.', unauthorized: true };
    }
    // Inject data session ke params agar endpoint bisa menggunakannya
    params._session = session;
  }

  // Route ke handler yang sesuai
  switch (action) {
    // Public
    case 'login'           : return epLogin(params);
    case 'signUp'          : return epSignUp(params);
    case 'requestPINReset' : return epRequestPINReset(params);
    case 'checkResetStatus': return epCheckResetStatus(params);

    // Protected
    case 'validateToken'      : return epValidateToken(params);
    case 'logout'             : return epLogout(params);
    case 'getDashboard'       : return epGetDashboard(params);
    case 'getOrderData'       : return epGetOrderData(params);
    case 'checkDuplicate'     : return epCheckDuplicate(params);
    case 'saveAttendance'     : return epSaveAttendance(params);
    case 'getHistory'         : return epGetHistory(params);
    case 'getRekapPreview'    : return epGetRekapPreview(params);
    case 'submitPaymentRequest': return epSubmitPaymentRequest(params);

    default:
      return { success: false, message: `Action "${action}" tidak dikenali` };
  }
}

// -----------------------------------------------------------------------------
// buildResponse() — Bungkus response dengan CORS headers
// -----------------------------------------------------------------------------
function buildResponse(data, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  return output;
}

// -----------------------------------------------------------------------------
// generateToken() — Generate random hex token untuk session
// -----------------------------------------------------------------------------
function generateToken(length) {
  length = length || SESSION_TOKEN_LENGTH;
  let token = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < length * 2; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// -----------------------------------------------------------------------------
// generateId() — Generate ID unik dengan prefix
// -----------------------------------------------------------------------------
function generateId(prefix) {
  const ts = new Date().getTime().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substr(2, 4).toUpperCase();
  return (prefix || 'ID') + '_' + ts + '_' + rnd;
}

// -----------------------------------------------------------------------------
// hashPin() — Hash PIN sebelum disimpan ke Sheets
// Menggunakan Utilities.computeDigest (SHA-256)
// -----------------------------------------------------------------------------
function hashPin(pin, salt) {
  salt = salt || SHEET_ID; // Gunakan SHEET_ID sebagai salt tetap
  const raw = pin + ':' + salt;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// -----------------------------------------------------------------------------
// verifyPin() — Verifikasi PIN input vs hash tersimpan
// -----------------------------------------------------------------------------
function verifyPin(inputPin, storedHash) {
  return hashPin(inputPin) === storedHash;
}

// -----------------------------------------------------------------------------
// now() — Timestamp sekarang dalam format lokal WIB
// -----------------------------------------------------------------------------
function now() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}

// -----------------------------------------------------------------------------
// nowDate() — Tanggal sekarang (yyyy-MM-dd)
// -----------------------------------------------------------------------------
function nowDate() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}

// -----------------------------------------------------------------------------
// logError() — Catat error ke console (tampil di Apps Script logs)
// -----------------------------------------------------------------------------
function logError(context, err) {
  console.error('[EFM ERROR] ' + context + ': ' + (err.message || err));
}

// -----------------------------------------------------------------------------
// logInfo() — Catat info ke console
// -----------------------------------------------------------------------------
function logInfo(context, msg) {
  console.log('[EFM INFO] ' + context + ': ' + msg);
}

// -----------------------------------------------------------------------------
// calculateDistance() — Haversine formula: hitung jarak 2 titik GPS (meter)
// -----------------------------------------------------------------------------
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = EARTH_RADIUS_METERS;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// -----------------------------------------------------------------------------
// cleanupExpiredSessions() — Hapus sesi kadaluarsa (jalankan via trigger harian)
// -----------------------------------------------------------------------------
function cleanupExpiredSessions() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.SESSIONS);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const toDelete = [];

  for (let i = data.length - 1; i >= 1; i--) {
    const expiresAt = new Date(data[i][COL_SESSIONS.EXPIRES_AT]);
    if (expiresAt < now) toDelete.push(i + 1);
  }

  toDelete.forEach(row => sheet.deleteRow(row));
  logInfo('cleanupExpiredSessions', 'Deleted ' + toDelete.length + ' expired sessions');
}
