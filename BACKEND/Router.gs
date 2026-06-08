// =============================================
// EFM SYSTEM V3 — ROUTER
// Multi-file architecture (no more mirror sheets)
// Tambah: signUp | Hapus: getCoachList
// =============================================

function doGet(e) {

  e = e || {};
  const param  = e.parameter || {};
  const action = clean_(param.action);
  const id     = clean_(param.id);

  // ─── QR SCAN REDIRECT ──────────────────────
  // Ketika klien scan QR barcode → buka form absen
  if (id && !action) {
    return HtmlService
      .createHtmlOutput(
        `<script>window.location.href="${EFM_CONFIG.WEB_APP_URL}?page=absen&order=${id}";</script>`
      )
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ─── API ENDPOINTS ─────────────────────────

  // AUTH
  if (action === 'login') {
    return corsResponse_(loginPIN(param.kodePIC, param.pin));
  }

  if (action === 'signUp') {
    return corsResponse_(signUpPIC(param.kodePIC, param.pin, param.confirmPin));
  }

  if (action === 'validateToken') {
    return corsResponse_(validateToken(param.token));
  }

  if (action === 'logout') {
    return corsResponse_(logoutSession(param.token));
  }

  // ─── PIN UNLOCK / RESET ────────────────────
  if (action === 'requestPINReset') {
    return corsResponse_(requestPINReset(param.kodePIC));
  }

  if (action === 'checkResetStatus') {
    return corsResponse_(checkResetStatus(param.requestId));
  }

  // Admin approve/reject → return HTML (dibuka di browser admin via email link)
  if (action === 'adminApproveReset') {
    const result = adminApproveReset(param.requestId, param.adminKey);
    return HtmlService.createHtmlOutput(result.html || '<p>Error</p>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (action === 'adminRejectReset') {
    const result = adminRejectReset(param.requestId, param.adminKey);
    return HtmlService.createHtmlOutput(result.html || '<p>Error</p>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ORDER DATA
  if (action === 'getOrderData') {
    return corsResponse_(getOrderData(param.orderId));
  }

  if (action === 'parseGoogleMapsLink') {
    return corsResponse_(parseGoogleMapsLink(param.link));
  }

  if (action === 'checkDuplicate') {
    return corsResponse_(checkDuplicateAttendance(param.orderId));
  }

  // DASHBOARD & HISTORY
  if (action === 'getDashboard') {
    return corsResponse_(getDashboard(param.token, param.kodePIC));
  }

  if (action === 'getHistory') {
    return corsResponse_(getHistory(param.token, param.kodePIC));
  }

  // ─── PAYMENT REQUEST ──────────────────────────
  if (action === 'getRekapPreview') {
    return corsResponse_(getRekapPreview(param.token, param.kodePIC, param.orderId));
  }

  if (action === 'getPaymentStatus') {
    return corsResponse_(getPaymentStatus(param.token, param.kodePIC));
  }

  // Admin konfirmasi pembayaran → return HTML (dibuka di browser admin via email link)
  if (action === 'adminConfirmPayment') {
    const result = adminConfirmPayment(param.noRekap, param.adminKey);
    return HtmlService.createHtmlOutput(result.html || '<p>Error</p>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // DEFAULT
  return corsResponse_({ system: 'EFM Backend V3', version: '3.0', status: 'running' });
}


// =============================================
// doPost — untuk saveAttendance
// =============================================
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = clean_(body.action);

    if (action === 'saveAttendance') {
      return corsResponse_(
        saveAttendance(
          body.token,
          body.kodePIC,
          body.namaPIC,
          body.orderId,
          body.base64Photo,
          body.latitude,
          body.longitude,
          body.device
        )
      );
    }

    if (action === 'submitPaymentRequest') {
      return corsResponse_(
        submitPaymentRequest(
          body.token,
          body.kodePIC,
          body.orderId,
          body.signatureBase64
        )
      );
    }

    return corsResponse_({ success: false, message: 'Action tidak dikenal' });

  } catch(err) {
    return corsResponse_({ success: false, message: err.message });
  }
}
