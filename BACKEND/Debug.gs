// =============================================
// EFM DEBUG TOOL — Jalankan di Apps Script Editor
// Cara: buka file ini > pilih fungsi > klik "Jalankan"
// =============================================


// =============================================
// STEP 1: Cek struktur kolom Database Orderan
// Jalankan ini dulu! Lihat hasil di Logger
// =============================================
function debugCekKolomOrderan() {

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Database Orderan");

  if (!sheet) {
    Logger.log("❌ Sheet 'Database Orderan' tidak ditemukan!");
    Logger.log("Sheet yang ada: " +
      SpreadsheetApp.getActiveSpreadsheet()
        .getSheets().map(s => s.getName()).join(", ")
    );
    return;
  }

  // Print header row
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log("=== HEADER KOLOM Database Orderan ===");
  headers.forEach((h, i) => {
    const col = String.fromCharCode(65 + i); // A, B, C, ...
    Logger.log(`Index ${i} (Kolom ${col}): "${h}"`);
  });

  // Print 3 baris sample data
  if (sheet.getLastRow() > 1) {
    Logger.log("\n=== SAMPLE DATA (3 baris pertama) ===");
    const sampleData = sheet.getRange(2, 1, Math.min(3, sheet.getLastRow() - 1),
      Math.min(5, sheet.getLastColumn())).getDisplayValues();

    sampleData.forEach((row, i) => {
      Logger.log(`Baris ${i + 2}: [${row.join(" | ")}]`);
    });
  }

  Logger.log("\n✅ Selesai! Perhatikan kolom mana yang berisi 'ID Order' (format: PP-IV-2026-XXXX)");
}


// =============================================
// STEP 2: Test lookup Order ID tertentu
// Ganti ORDER_ID_TEST dengan ID yang ada di sheet
// =============================================
function debugTestOrderLookup() {

  // ⬇️ GANTI dengan Order ID yang ingin dicari
  const ORDER_ID_TEST = "PP-IV-2026-0001";

  Logger.log("=== TEST LOOKUP ORDER ID: " + ORDER_ID_TEST + " ===");

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Database Orderan");

  if (!sheet) {
    Logger.log("❌ Sheet tidak ditemukan");
    return;
  }

  const data = sheet.getDataRange().getDisplayValues();
  const searchId = ORDER_ID_TEST.toString()
    .replace(/\s+/g, "").trim().toUpperCase();

  Logger.log("Mencari: '" + searchId + "'");
  Logger.log("Total baris data: " + (data.length - 1));
  Logger.log("Total kolom: " + (data[0] ? data[0].length : 0));

  // Cek SETIAP kolom di 5 baris pertama untuk menemukan nilai yang match
  Logger.log("\n=== SEMUA NILAI DI 5 BARIS PERTAMA ===");
  for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
    for (let j = 0; j < data[i].length; j++) {
      const val = (data[i][j] || "").toString().trim();
      if (val) {
        const col = j < 26
          ? String.fromCharCode(65 + j)
          : "A" + String.fromCharCode(65 + (j - 26));
        Logger.log(`  Baris ${i+1}, Kolom ${col} (index ${j}): "${val}"`);
      }
    }
    Logger.log("---");
  }

  // Cari order ID di SEMUA kolom
  Logger.log("\n=== PENCARIAN DI SEMUA KOLOM ===");
  let ditemukan = false;
  for (let i = 1; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      const val = (data[i][j] || "").toString()
        .replace(/\s+/g, "").trim().toUpperCase();
      if (val === searchId) {
        const col = j < 26
          ? String.fromCharCode(65 + j)
          : "A" + String.fromCharCode(65 + (j - 26));
        Logger.log(`✅ DITEMUKAN di Baris ${i+1}, Kolom ${col} (index ${j})`);
        Logger.log(`   Seluruh baris: [${data[i].join(" | ")}]`);
        ditemukan = true;
      }
    }
  }

  if (!ditemukan) {
    Logger.log("❌ Order ID '" + searchId + "' TIDAK DITEMUKAN di sheet manapun");
    Logger.log("Pastikan format ID sudah benar (cek huruf besar/kecil, spasi, tanda hubung)");
  }
}


// =============================================
// STEP 3: Debug isi QR Barcode
// Masukkan nilai yang terbaca dari QR scan
// =============================================
function debugTestQRValue() {

  // ⬇️ GANTI dengan nilai yang terbaca saat scan QR
  // (lihat di field 'Order ID' di form absensi setelah scan)
  const QR_VALUE = "MASUKKAN_NILAI_QR_DISINI";

  Logger.log("=== TEST QR VALUE: '" + QR_VALUE + "' ===");

  // Simulate URL parsing (sama seperti di index.html)
  let orderId = QR_VALUE;
  try {
    // Coba parse sebagai URL
    const urlObj = new URL(QR_VALUE);
    const fromOrder = urlObj.searchParams.get('order');
    const fromId = urlObj.searchParams.get('id');
    orderId = fromOrder || fromId || QR_VALUE;
    Logger.log("QR berisi URL. Parameter:");
    Logger.log("  ?order = " + fromOrder);
    Logger.log("  ?id    = " + fromId);
    Logger.log("  Hasil orderId: " + orderId);
  } catch(e) {
    Logger.log("QR berisi plain text (bukan URL): " + orderId);
  }

  Logger.log("\nOrderId yang akan dicari: '" + orderId.trim().toUpperCase() + "'");

  // Coba lookup ke Database Orderan
  const result = getOrderData(orderId.trim());
  Logger.log("\nHasil getOrderData:");
  Logger.log(JSON.stringify(result, null, 2));
}


// =============================================
// STEP 4: Print semua Order ID yang ada di database
// Berguna untuk cek format yang benar
// =============================================
function debugListAllOrderIds() {

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Database Orderan");

  if (!sheet) {
    Logger.log("❌ Sheet tidak ditemukan");
    return;
  }

  const data = sheet.getDataRange().getDisplayValues();

  Logger.log("=== SEMUA ORDER ID DI DATABASE ORDERAN ===");
  Logger.log("(Kolom B, index 1 — sesuai Config.gs)");
  Logger.log("");

  for (let i = 1; i < data.length; i++) {
    const colB_val = data[i][1]; // index 1 = kolom B
    if (colB_val) {
      Logger.log(`Baris ${i+1} | Kolom B: "${colB_val}"`);
    }
  }

  Logger.log("\n✅ Selesai. Bandingkan dengan nilai QR yang Anda scan.");
}
