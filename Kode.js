const FOLDER_ID = "1WWyO7uAyLt_NBaLK3htE4lXePgjsC4O5";
const JURNAL_FOLDER_ID = FOLDER_ID; // Jurnal photos stored in same folder (or change to separate folder)

function doPost(e) {
  try {
    if (!e.postData) {
      throw new Error("Tidak ada data POST yang diterima.");
    }

    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      throw new Error("Format JSON salah");
    }

    // --- LOGIC LOGIN SISWA ---
    if (data.action === "login") {
      const sheetSiswa = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Siswa");
      if (!sheetSiswa) throw new Error("Sheet 'Siswa' tidak ditemukan di database.");

      const dataSiswa = sheetSiswa.getDataRange().getDisplayValues();

      for (let i = 1; i < dataSiswa.length; i++) {
        if (dataSiswa[i][0] == data.nisn) {
          // Asumsi Kolom G (index 6) adalah Tgl Lahir di sheet Siswa
          let sheetVal = dataSiswa[i][6];
          let tglSheet = "";
          if (Object.prototype.toString.call(sheetVal) === '[object Date]') {
            let y = sheetVal.getFullYear();
            let m = String(sheetVal.getMonth() + 1).padStart(2, '0');
            let d = String(sheetVal.getDate()).padStart(2, '0');
            tglSheet = `${y}-${m}-${d}`;
          } else {
            tglSheet = String(sheetVal).trim();
          }
          let tglInput = String(data.tglLahir).trim();

          let normalize = (str) => {
            let p = str.split(/[\/\-]/);
            if (p.length === 3) {
              if (p[0].length === 4) {
                return p[0] + "-" + p[1].padStart(2, '0') + "-" + p[2].padStart(2, '0');
              } else if (p[2].length === 4) {
                return p[2] + "-" + p[1].padStart(2, '0') + "-" + p[0].padStart(2, '0');
              }
            }
            return str;
          };

          if (normalize(tglSheet) === normalize(tglInput)) {
            return ContentService.createTextOutput(JSON.stringify({
              status: "success",
              message: "Login Berhasil",
              nama: dataSiswa[i][1] // Kolom B adalah Nama
            })).setMimeType(ContentService.MimeType.JSON);
          } else {
            throw new Error("NISN atau Tanggal Lahir tidak cocok.");
          }
        }
      }
      throw new Error("NISN tidak terdaftar di sistem.");
    }

    // --- LOGIC LOGIN GURU ---
    if (data.action === "login_guru") {
      const sheetGuru = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pembimbing");
      if (!sheetGuru) throw new Error("Sheet 'Pembimbing' tidak ditemukan di database.");

      const dataGuru = sheetGuru.getDataRange().getDisplayValues();
      for (let i = 1; i < dataGuru.length; i++) {
        // Asumsi Kolom A (0) = ID, Kolom B (1) = Nama, Kolom C (2) = Secret
        if (dataGuru[i][0] == data.idGuru && dataGuru[i][2] == data.secret) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: "Login Guru Berhasil",
            nama: dataGuru[i][1]
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      throw new Error("ID Pembimbing atau Kata Sandi salah.");
    }

    // --- LOGIC SIMPAN ABSENSI ---
    if (data.action === "absen") {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Absensi");

      const tanggalSekarang = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy");
      const waktuSekarang = Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");

      // Validasi 1 Kali Sehari
      const dataAbsensi = sheet.getDataRange().getDisplayValues();
      for (let i = dataAbsensi.length - 1; i >= 1; i--) {
        if (dataAbsensi[i][3] == data.nisn && dataAbsensi[i][1] == tanggalSekarang) {
          throw new Error("Anda sudah melakukan absensi hari ini!");
        }
      }

      // Validasi Fake GPS (Server Side)
      if (data.status === 'Hadir') {
        if (!data.gpsHistory || data.gpsHistory.length < 3) {
          throw new Error("Peringatan: Gagal mendapatkan sinyal GPS yang stabil. Mohon tunggu beberapa detik sebelum mengirim absen.");
        }
        let first = data.gpsHistory[0];
        let isStatic = data.gpsHistory.every(p => p.lat === first.lat && p.lng === first.lng);
        if (isStatic) {
          throw new Error("Peringatan: Sistem mendeteksi lokasi tidak wajar (Statis). Penggunaan Fake GPS tidak diizinkan!");
        }
      }

      // Ambil detail siswa (Lokasi PKL & Pembimbing)
      const sheetSiswa = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Siswa");
      let psgLat = null, psgLng = null, lokasiPKL = "", pembimbing = "";

      if (sheetSiswa) {
        const dataSiswa = sheetSiswa.getDataRange().getDisplayValues();
        for (let i = 1; i < dataSiswa.length; i++) {
          if (dataSiswa[i][0] == data.nisn) {
            pembimbing = dataSiswa[i][3]; // Kolom D
            lokasiPKL = dataSiswa[i][4];  // Kolom E
            break;
          }
        }
      }

      // Validasi Jarak Radius PSG (50m) jika Hadir
      if (data.status === 'Hadir' && data.lat && data.lng && lokasiPKL) {
        const sheetTempat = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tempat PSG");
        if (sheetTempat) {
          const dataTempat = sheetTempat.getDataRange().getDisplayValues();
          for (let j = 1; j < dataTempat.length; j++) {
            if (dataTempat[j][0] == lokasiPKL) {
              psgLat = parseFloat(dataTempat[j][1].toString().replace(',', '.'));
              psgLng = parseFloat(dataTempat[j][2].toString().replace(',', '.'));
              break;
            }
          }
        }

        if (psgLat && psgLng) {
          let getDistanceFromLatLonInM = (lat1, lon1, lat2, lon2) => {
            var R = 6371000;
            var deg2rad = (deg) => deg * (Math.PI / 180);
            var dLat = deg2rad(lat2 - lat1);
            var dLon = deg2rad(lon2 - lon1);
            var a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          };

          var jarak = getDistanceFromLatLonInM(parseFloat(data.lat), parseFloat(data.lng), psgLat, psgLng);
          if (jarak > 50) {
            throw new Error("Anda berada di luar radius absensi (Jarak: " + Math.round(jarak) + "m dari " + lokasiPKL + "). Max: 50m.");
          }
        }
      }

      // Proses foto Base64 ke Google Drive
      let fileUrl = "";
      if (data.photoBase64) {
        let folder = DriveApp.getFolderById(FOLDER_ID);
        let mimeType = data.photoBase64.substring(5, data.photoBase64.indexOf(';'));
        let base64Data = data.photoBase64.split(',')[1];
        let blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, "Absen_" + data.nisn + "_" + new Date().getTime());
        let file = folder.createFile(blob);
        fileUrl = file.getUrl();
      }

      // Kolom: [ID_Absensi, Tanggal, Waktu, NISN, Latitude, Longitude, Status, Link_Foto, Alasan, Pembimbing, Agenda]
      let rowData = [
        "ABS-" + new Date().getTime(),
        tanggalSekarang,
        waktuSekarang,
        data.nisn,
        data.lat || "",
        data.lng || "",
        data.status,
        fileUrl,
        data.alasan || "",
        pembimbing,
        data.agenda || ""
      ];

      sheet.appendRow(rowData);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Absensi berhasil dicatat!",
        fileUrl: fileUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- LOGIC SIMPAN AGENDA HARIAN ---
    if (data.action === "submitAgendaHarian") {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Absensi");
      if (!sheet) throw new Error("Sheet 'Absensi' tidak ditemukan.");

      const tanggalSekarang = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy");
      const dataAbsensi = sheet.getDataRange().getDisplayValues();
      let rowIndex = -1;

      for (let i = dataAbsensi.length - 1; i >= 1; i--) {
        if (dataAbsensi[i][3] == data.nisn && dataAbsensi[i][1] == tanggalSekarang) {
          rowIndex = i + 1; // Google Sheets row numbers are 1-based
          break;
        }
      }

      if (rowIndex !== -1) {
        // Kolom 11 adalah kolom K (Agenda Harian)
        sheet.getRange(rowIndex, 11).setValue(data.agenda);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Jurnal harian berhasil disimpan!"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        throw new Error("Anda belum absen hari ini. Silakan absen kehadiran terlebih dahulu sebelum mengisi jurnal harian.");
      }
    }

    // --- LOGIC SIMPAN JURNAL MINGGUAN ---
    if (data.action === "submitJurnal") {
      const sheetJurnal = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jurnal");
      if (!sheetJurnal) {
        // Auto-create sheet if not exists
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const newSheet = ss.insertSheet("Jurnal");
        newSheet.appendRow(["ID", "NISN", "Week_ID", "Week_Start", "Week_End", "Tanggal_Kirim", "Waktu_Kirim", "Keterangan", "Foto1", "Foto2", "Foto3", "Jumlah_Foto"]);
      }

      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jurnal");
      const tanggalKirim = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy");
      const waktuKirim = Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");

      // Check duplicate: 1 jurnal per week per student
      const existingData = sheet.getDataRange().getDisplayValues();
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][1] == data.nisn && existingData[i][2] == data.weekId) {
          throw new Error("Jurnal untuk minggu ini sudah pernah dikirim!");
        }
      }

      // Foto dikirim secara sekuensial via action appendJurnalPhoto

      // Row: [ID, NISN, Week_ID, Week_Start, Week_End, Tanggal_Kirim, Waktu_Kirim, Keterangan, Foto (comma-separated), "", "", Jumlah_Foto]
      let newId = "JRN-" + new Date().getTime();
      let rowData = [
        newId,
        data.nisn,
        data.weekId,
        data.weekStart || "",
        data.weekEnd || "",
        tanggalKirim,
        waktuKirim,
        data.keterangan || "",
        "",       // Foto1: akan di-append foto satu per satu secara sekuensial
        "",       // Foto2: kosong (legacy)
        "",       // Foto3: kosong (legacy)
        0         // Jumlah_Foto: 0
      ];

      sheet.appendRow(rowData);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Jurnal mingguan berhasil dikirim! Menunggu upload foto...",
        id: newId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- LOGIC EDIT JURNAL MINGGUAN ---
    if (data.action === "editJurnal") {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jurnal");
      if (!sheet) throw new Error("Sheet Jurnal tidak ditemukan.");

      const existingData = sheet.getDataRange().getDisplayValues();
      let rowIndex = -1;
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][0] == data.id && existingData[i][1] == data.nisn) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) throw new Error("Jurnal tidak ditemukan untuk diedit.");

      const tanggalKirim = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy");
      const waktuKirim = Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");

      // Update Keterangan saja, kosongkan foto karena akan di-append ulang
      sheet.getRange(rowIndex, 6).setValue(tanggalKirim);
      sheet.getRange(rowIndex, 7).setValue(waktuKirim);
      sheet.getRange(rowIndex, 8).setValue(data.keterangan || "");
      sheet.getRange(rowIndex, 9).setValue("");
      sheet.getRange(rowIndex, 10).setValue("");
      sheet.getRange(rowIndex, 11).setValue("");
      sheet.getRange(rowIndex, 12).setValue(0);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Jurnal berhasil diperbarui!",
        id: data.id
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- LOGIC APPEND FOTO JURNAL (Upload Sekuensial) ---
    if (data.action === "appendJurnalPhoto") {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jurnal");
      if (!sheet) throw new Error("Sheet Jurnal tidak ditemukan.");

      const existingData = sheet.getDataRange().getDisplayValues();
      let rowIndex = -1;
      let existingPhotos = "";

      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][0] == data.id && existingData[i][1] == data.nisn) {
          rowIndex = i + 1;
          existingPhotos = existingData[i][8] || ""; // Kolom Foto (I/index 9)
          break;
        }
      }

      if (rowIndex === -1) throw new Error("Jurnal tidak ditemukan.");

      // Upload foto ke Drive
      let photoUrl = "";
      if (data.photoBase64) {
        let folder = DriveApp.getFolderById(FOLDER_ID);
        let mimeType = data.photoBase64.substring(5, data.photoBase64.indexOf(';'));
        let base64Data = data.photoBase64.split(',')[1];
        let blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, "Jurnal_" + data.nisn + "_" + new Date().getTime());
        let file = folder.createFile(blob);
        photoUrl = file.getUrl();
      }

      // Append URL ke kolom Foto (index 9), pisahkan dengan koma
      let newPhotoStr = existingPhotos ? existingPhotos + ", " + photoUrl : photoUrl;
      let currentCount = newPhotoStr ? newPhotoStr.split(',').length : 0;

      sheet.getRange(rowIndex, 9).setValue(newPhotoStr);
      sheet.getRange(rowIndex, 12).setValue(currentCount);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Foto berhasil ditambahkan!",
        photoUrl: photoUrl,
        photoCount: currentCount
      })).setMimeType(ContentService.MimeType.JSON);
    }



    // --- LOGIC HAPUS JURNAL ---
    if (data.action === "deleteJurnal") {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jurnal");
      if (!sheet) throw new Error("Sheet 'Jurnal' tidak ditemukan.");
      const dataJurnal = sheet.getDataRange().getDisplayValues();
      let rowIndex = -1;
      for (let i = 1; i < dataJurnal.length; i++) {
        if (dataJurnal[i][0] == data.id && dataJurnal[i][1] == data.nisn) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex !== -1) {
        sheet.deleteRow(rowIndex);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Jurnal berhasil dihapus!"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        throw new Error("Jurnal tidak ditemukan atau tidak ada akses.");
      }
    }

    // --- LOGIC HAPUS ABSEN HARI INI ---
    if (data.action === "deleteAbsen") {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Absensi");
      if (!sheet) throw new Error("Sheet 'Absensi' tidak ditemukan.");
      const tanggalSekarang = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy");
      const dataAbsensi = sheet.getDataRange().getDisplayValues();
      let rowIndex = -1;

      for (let i = dataAbsensi.length - 1; i >= 1; i--) {
        if (dataAbsensi[i][3] == data.nisn && dataAbsensi[i][1] == tanggalSekarang) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex !== -1) {
        sheet.deleteRow(rowIndex);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Absensi hari ini berhasil dihapus!"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        throw new Error("Tidak ada absen hari ini yang bisa dihapus.");
      }
    }

    // Jika tidak ada action yang cocok
    throw new Error("Action POST tidak dikenali: " + data.action);

  } catch (error) {
    // Tangkap semua error dan kirim sebagai JSON
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // CORS Preflight
  if (!e.parameter.action) {
    return ContentService.createTextOutput("API Absensi PKL Aktif.").setMimeType(ContentService.MimeType.JSON);
  }

  // Helper function to read Pengaturan
  function getPengaturan() {
    let setting = { tglMulai: "", tglSelesai: "", libur: [] };
    const sheetPengaturan = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pengaturan");
    if (sheetPengaturan) {
      const data = sheetPengaturan.getDataRange().getDisplayValues();
      if (data.length > 1) {
        setting.tglMulai = data[1][0] || "";
        setting.tglSelesai = data[1][1] || "";
        let liburStr = data[1][2] || "";
        setting.libur = liburStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
    }
    return setting;
  }

  // --- ENDPOINT UNTUK SISWA MENGAMBIL REKAP ---
  if (e.parameter.action === "getRekap") {
    try {
      const nisn = e.parameter.nisn;
      const bulanParam = e.parameter.bulan || "all";
      const pengaturan = getPengaturan();

      // Ambil lokasi PSG
      let psgLat = null;
      let psgLng = null;
      let lokasiPKL = "";
      const sheetSiswa = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Siswa");
      if (sheetSiswa) {
        const dataSiswa = sheetSiswa.getDataRange().getDisplayValues();
        for (let i = 1; i < dataSiswa.length; i++) {
          if (dataSiswa[i][0] == nisn) {
            lokasiPKL = dataSiswa[i][4];
            break;
          }
        }
      }

      if (lokasiPKL) {
        const sheetTempat = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tempat PSG");
        if (sheetTempat) {
          const dataTempat = sheetTempat.getDataRange().getDisplayValues();
          for (let j = 1; j < dataTempat.length; j++) {
            if (dataTempat[j][0] == lokasiPKL) {
              psgLat = dataTempat[j][1];
              psgLng = dataTempat[j][2];
              break;
            }
          }
        }
      }

      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Absensi");
      const dataAbsensi = sheet ? sheet.getDataRange().getDisplayValues() : [];
      let records = [];

      for (let i = dataAbsensi.length - 1; i >= 1; i--) {
        if (dataAbsensi[i][3] == nisn) {
          let tanggalStr = dataAbsensi[i][1];
          let parts = tanggalStr.split('/');

          if (bulanParam !== "all" && parts.length === 3) {
            let b = parts[1].replace(/^0+/, '');
            if (b !== bulanParam) continue;
          }

          records.push({
            tanggal: tanggalStr,
            waktu: dataAbsensi[i][2],
            lat: dataAbsensi[i][4],
            lng: dataAbsensi[i][5],
            status: dataAbsensi[i][6],
            foto: dataAbsensi[i][7],
            alasan: dataAbsensi[i][8],
            agenda: dataAbsensi[i][10] || ""
          });
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: records,
        pengaturan: pengaturan,
        psgLat: psgLat,
        psgLng: psgLng,
        lokasiPKL: lokasiPKL
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: error.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // --- ENDPOINT UNTUK GURU MENGAMBIL REKAP SISWANYA ---
  if (e.parameter.action === "getRekapGuru") {
    try {
      const namaGuru = e.parameter.namaGuru;
      const bulanParam = e.parameter.bulan || "all";
      const pengaturan = getPengaturan();

      // 1. Ambil NISN milik siswa bimbingan guru ini
      const sheetSiswa = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Siswa");
      if (!sheetSiswa) throw new Error("Sheet Siswa tidak ada.");
      const dataSiswa = sheetSiswa.getDataRange().getDisplayValues();

      let nisnSiswa = [];
      let mapNamaSiswa = {};
      let daftarSiswa = [];

      // Read Tempat PSG data for location details
      let tempatPsgMap = {};
      const sheetTempat = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tempat PSG");
      if (sheetTempat) {
        const dataTempat = sheetTempat.getDataRange().getDisplayValues();
        for (let j = 1; j < dataTempat.length; j++) {
          tempatPsgMap[dataTempat[j][0]] = {
            nama: dataTempat[j][0],
            lat: dataTempat[j][1],
            lng: dataTempat[j][2],
            alamat: dataTempat[j][3] || "",
            contactPerson: dataTempat[j][4] || "",
            noTelpCP: dataTempat[j][5] || "",
            pemilik: dataTempat[j][6] || ""
          };
        }
      }

      for (let i = 1; i < dataSiswa.length; i++) {
        // Kolom A(0)=NISN, B(1)=Nama, C(2)=Kelas, D(3)=Pembimbing, E(4)=Lokasi PKL, F(5)=Kontak, G(6)=Tgl Lahir
        let namaGuruDiSheet = String(dataSiswa[i][3]).trim().toLowerCase();
        let namaGuruDicari = String(namaGuru).trim().toLowerCase();

        if (namaGuruDiSheet === namaGuruDicari) {
          let lokasiPKL = dataSiswa[i][4];
          let psgDetail = tempatPsgMap[lokasiPKL] || null;

          nisnSiswa.push(dataSiswa[i][0]);
          mapNamaSiswa[dataSiswa[i][0]] = dataSiswa[i][1];
          daftarSiswa.push({
            nisn: dataSiswa[i][0],
            nama: dataSiswa[i][1],
            kelas: dataSiswa[i][2],
            kontak: dataSiswa[i][5],
            lokasiPKL: lokasiPKL,
            psgDetail: psgDetail
          });
        }
      }

      // 2. Ambil absen mereka
      const sheetAbsen = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Absensi");
      if (!sheetAbsen) throw new Error("Sheet Absensi tidak ada.");
      const dataAbsensi = sheetAbsen.getDataRange().getDisplayValues();
      let result = [];

      for (let i = dataAbsensi.length - 1; i >= 1; i--) {
        let nisn = dataAbsensi[i][3];
        if (nisnSiswa.includes(nisn)) {
          let tanggalStr = dataAbsensi[i][1];
          let parts = tanggalStr.split('/');
          let matchBulan = true;

          if (bulanParam !== "all" && parts.length === 3) {
            let b = parts[1].replace(/^0+/, '');
            if (b !== bulanParam) matchBulan = false;
          }

          if (matchBulan) {
            result.push({
              nisn: nisn,
              nama: mapNamaSiswa[nisn],
              tanggal: tanggalStr,
              waktu: dataAbsensi[i][2],
              lat: dataAbsensi[i][4],
              lng: dataAbsensi[i][5],
              status: dataAbsensi[i][6],
              foto: dataAbsensi[i][7],
              alasan: dataAbsensi[i][8],
              agenda: dataAbsensi[i][10] || ""
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: result,
        siswa: daftarSiswa,
        pengaturan: pengaturan
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error", message: err.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // --- ENDPOINT UNTUK SISWA MENGAMBIL JURNAL ---
  if (e.parameter.action === "getJurnal") {
    try {
      const nisn = e.parameter.nisn;
      const sheetJurnal = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jurnal");

      if (!sheetJurnal) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          data: []
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const dataJurnal = sheetJurnal.getDataRange().getDisplayValues();
      let records = [];

      for (let i = dataJurnal.length - 1; i >= 1; i--) {
        if (dataJurnal[i][1] == nisn) {
          let photoUrls = [];
          if (dataJurnal[i][8]) {
            // Karena sekarang foto digabung dengan koma
            photoUrls = dataJurnal[i][8].split(',').map(u => u.trim()).filter(u => u.length > 0);
          }

          records.push({
            id: dataJurnal[i][0],
            weekId: dataJurnal[i][2],
            weekStart: dataJurnal[i][3],
            weekEnd: dataJurnal[i][4],
            tanggal: dataJurnal[i][5],
            waktu: dataJurnal[i][6],
            keterangan: dataJurnal[i][7],
            photoUrls: photoUrls,
            photoCount: parseInt(dataJurnal[i][11]) || photoUrls.length
          });
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: records
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: error.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // --- ENDPOINT UNTUK GURU MENGAMBIL JURNAL SISWANYA ---
  if (e.parameter.action === "getJurnalGuru") {
    try {
      const namaGuru = e.parameter.namaGuru;
      const bulanParam = e.parameter.bulan || "all";

      // Get student list for this teacher
      const sheetSiswa = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Siswa");
      if (!sheetSiswa) throw new Error("Sheet Siswa tidak ada.");
      const dataSiswa = sheetSiswa.getDataRange().getDisplayValues();

      let nisnSiswa = [];
      let mapNamaSiswa = {};

      for (let i = 1; i < dataSiswa.length; i++) {
        let namaGuruDiSheet = String(dataSiswa[i][3]).trim().toLowerCase();
        let namaGuruDicari = String(namaGuru).trim().toLowerCase();

        if (namaGuruDiSheet === namaGuruDicari) {
          nisnSiswa.push(dataSiswa[i][0]);
          mapNamaSiswa[dataSiswa[i][0]] = dataSiswa[i][1];
        }
      }

      const sheetJurnal = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jurnal");
      let records = [];

      if (sheetJurnal) {
        const dataJurnal = sheetJurnal.getDataRange().getDisplayValues();

        for (let i = dataJurnal.length - 1; i >= 1; i--) {
          let nisn = dataJurnal[i][1];
          if (nisnSiswa.includes(nisn)) {
            let tanggalKirimStr = dataJurnal[i][5] || ""; // Kolom Tanggal Kirim
            let parts = tanggalKirimStr.split('/');
            let matchBulan = true;

            if (bulanParam !== "all" && parts.length === 3) {
              let b = parts[1].replace(/^0+/, '');
              if (b !== bulanParam) matchBulan = false;
            }

            if (matchBulan) {
              let photoUrls = [];
              if (dataJurnal[i][8]) {
                photoUrls = dataJurnal[i][8].split(',').map(u => u.trim()).filter(u => u.length > 0);
              }

              records.push({
                id: dataJurnal[i][0],
                nisn: nisn,
                nama: mapNamaSiswa[nisn] || nisn,
                weekId: dataJurnal[i][2],
                weekStart: dataJurnal[i][3],
                weekEnd: dataJurnal[i][4],
                tanggal: dataJurnal[i][5],
                waktu: dataJurnal[i][6],
                keterangan: dataJurnal[i][7],
                photoUrls: photoUrls,
                photoCount: parseInt(dataJurnal[i][11]) || photoUrls.length
              });
            }
          }
        }
      } // <--- Added missing brace for if (sheetJurnal)
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: records
      })).setMimeType(ContentService.MimeType.JSON);
      
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: "Action GET tidak valid"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ==============================================================================
  // FUNGSI HELPER UNTUK MENGATASI ERROR IZIN (PERMISSION) DRIVEAPP
  // ==============================================================================
  // Buka dropdown di menu atas editor Apps Script, pilih fungsi "authorizeDrive"
  // lalu klik tombol "Jalankan" (Run). Ini akan memancing Google untuk memunculkan
  // pop-up Review Permissions. Anda hanya perlu melakukannya 1 kali saja.
  function authorizeDrive() {
    const folder = DriveApp.getRootFolder();
    // Membuat file dummy agar Google meminta izin "create" (Full Drive Access)
    const dummyFile = folder.createFile("test_izin_apps_script.txt", "dummy");
    dummyFile.setTrashed(true); // Langsung pindahkan ke tempat sampah

    SpreadsheetApp.getActiveSpreadsheet();
    Logger.log("Izin Full Akses Drive & Spreadsheet berhasil diberikan!");
  }
  function compressOldPhotos() {
  const folderId = "1WWyO7uAyLt_NBaLK3htE4lXePgjsC4O5";
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  
  let count = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    const size = file.getSize(); // dalam bytes
    
    // Hanya kompres file yang ukurannya di atas 200 KB (204800 bytes)
    if (size > 204800 && (file.getMimeType() === MimeType.JPEG || file.getMimeType() === MimeType.PNG)) {
      const fileId = file.getId();
      
      try {
        // 1. Ambil versi kompresi dari server Thumbnail Google (lebar 800px)
        const thumbUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w800";
        const response = UrlFetchApp.fetch(thumbUrl);
        const blob = response.getBlob();
        
        // 2. Timpa isi file asli dengan blob kompresi via REST API (ID File Tetap Sama!)
        const updateUrl = 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media';
        const options = {
          method: 'PATCH',
          contentType: blob.getContentType(),
          payload: blob.getBytes(),
          headers: {
            Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
          },
          muteHttpExceptions: true
        };
        
        const updateResponse = UrlFetchApp.fetch(updateUrl, options);
        
        if (updateResponse.getResponseCode() === 200) {
          Logger.log("Berhasil kompres: " + file.getName() + " (Turun dari " + Math.round(size/1024) + " KB)");
          count++;
        } else {
          Logger.log("Gagal update " + file.getName() + ": " + updateResponse.getContentText());
        }
      } catch (e) {
        Logger.log("Error pada " + file.getName() + ": " + e.toString());
      }
    }
  }
  
  Logger.log("Selesai! Total file yang berhasil dikompres: " + count);
}

