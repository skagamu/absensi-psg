# Panduan Penggunaan Sistem Absensi PSG SKAGAMU

Dokumen ini berisi panduan penggunaan sistem absensi Praktik Sistem Ganda (PSG) / PKL SKAGAMU yang terbagi menjadi 3 peran: **Admin (Operator Server)**, **Siswa (Peserta PKL)**, dan **Guru (Pembimbing)**.

---

## 1. Panduan Untuk Admin (Pengelola Sistem)

Admin bertugas untuk mengelola database di Google Sheets dan memastikan backend (Google Apps Script) berjalan dengan baik.

### A. Persiapan Database (Google Sheets)
Sistem ini menggunakan Google Sheets sebagai database. Master Database dapat diakses pada link berikut:
**[Database Absensi PSG SKAGAMU](https://docs.google.com/spreadsheets/d/1frEW1jl9X2RYt-JOuEOgJZcd0cVpmehOHLSGD-JiEaA/edit?gid=1408970532#gid=1408970532)**

Pastikan format penamaan dan struktur tab sheet tidak diubah. Berikut adalah daftar tabel (sheet) yang harus ada:
1. **Pengaturan:** Mengatur tanggal mulai, tanggal selesai, dan hari libur (format DD/MM/YYYY dipisah koma).
2. **Siswa:** Master data siswa. (Kolom: NISN, Nama, Kelas, Pembimbing, Lokasi PKL, Kontak, Tgl Lahir).
3. **Pembimbing:** Master data guru pembimbing. (Kolom: ID_Guru, Nama_Guru, Secret_Password).
4. **Tempat PSG:** Master data lokasi PKL beserta koordinat GPS (Latitude, Longitude) dan kontak instansi.
5. **Absensi:** Data otomatis yang akan diisi oleh sistem ketika siswa melakukan absen.
6. **Jurnal:** Data otomatis yang akan diisi oleh sistem ketika siswa mengirim jurnal mingguan.

### B. Konfigurasi Server Saat Ini
Untuk referensi, berikut adalah alamat dan ID yang sedang digunakan oleh sistem saat ini:
- **Database (Google Sheets):** [Klik di sini untuk membuka](https://docs.google.com/spreadsheets/d/1frEW1jl9X2RYt-JOuEOgJZcd0cVpmehOHLSGD-JiEaA/edit?gid=1408970532#gid=1408970532)
- **URL Backend (Apps Script):** `https://script.google.com/macros/s/AKfycbzJWdUPFWpuGEm6jY1cVsgUr-h1S9qAewQxDPxn3R9vkEQ9I8tnPaItJDchdt_TAE2blg/exec`
- **ID Folder Google Drive (Lokasi Foto):** `1WWyO7uAyLt_NBaLK3htE4lXePgjsC4O5`

### C. Panduan Ubah Lokasi Upload Foto (Opsional)
Jika di kemudian hari Anda membuat folder Google Drive baru untuk menampung foto:
1. Pastikan folder tersebut di set privasinya menjadi "Anyone with the link can view".
2. Ambil ID Folder dari URL browser.
3. Masukkan ID tersebut pada baris `const FOLDER_ID = "..."` di `google_apps_script.js` lalu deploy ulang.

---

## 2. Panduan Untuk Siswa (Peserta PSG/PKL)

Aplikasi absen siswa dirancang sebagai Progressive Web App (PWA) yang bisa dipasang di HP layaknya aplikasi biasa tanpa harus lewat Play Store.

### A. Cara Instalasi (Add to Home Screen)
**Di Android (Google Chrome):**
1. Buka link **[https://skagamu.github.io/absensi-psg/](https://skagamu.github.io/absensi-psg/)** di browser Chrome.
2. Jika muncul *pop-up* di bawah layar bertuliskan "Tambahkan ke Layar Utama" (Add to Home screen), klik *pop-up* tersebut.
3. Jika tidak muncul, klik tombol titik tiga (menu) di pojok kanan atas Chrome, lalu pilih **Tambahkan ke Layar Utama**.
4. Klik *Add* (Tambah). Ikon "Absensi PSG SKAGAMU" akan muncul di menu HP Anda. Buka aplikasi tersebut untuk absen harian.

**Di iPhone/iOS (Safari):**
1. Buka link **[https://skagamu.github.io/absensi-psg/](https://skagamu.github.io/absensi-psg/)** di Safari.
2. Ketuk tombol *Share* (kotak dengan panah ke atas) di bagian bawah layar.
3. Gulir ke bawah dan pilih **Tambah ke Layar Utama** (Add to Home Screen).

### B. Cara Login
1. Buka aplikasi absen siswa yang sudah diinstal.
2. Masukkan **NISN** dan **Tanggal Lahir**.
3. Pastikan data yang Anda masukkan sesuai dengan yang ada di database sekolah.
4. Klik tombol **Masuk**. Jika berhasil, Anda akan dibawa ke halaman utama (Dashboard).

### C. Cara Absen Harian
1. Pastikan Anda sudah berada di lokasi tempat PKL/PSG (Sistem akan mengunci jarak maksimal 50 meter dari titik lokasi tempat PSG yang sudah didaftarkan).
2. Buka menu tab **Kehadiran** (ikon Kamera).
3. Izinkan akses **Kamera** dan **Lokasi/GPS** saat browser meminta izin.
4. Pilih Keterangan Kehadiran (Hadir / Sakit / Izin). Khusus "Hadir", tombol foto tidak akan aktif jika Anda belum berada dalam radius 50m.
5. Untuk Sakit/Izin, Anda wajib mengisi kolom *Alasan*.
6. Klik tombol **Silakan Ambil Foto**, senyum menghadap kamera, dan klik kirim.
7. *Catatan:* Jika Anda melakukan kesalahan (misal salah foto), Anda bisa menghapus absen hari itu dengan memencet tombol **Batal** berlambang tempat sampah di menu **Dashboard**, lalu melakukan absen ulang.

### D. Mengisi Jurnal Mingguan
1. Buka menu tab **Jurnal** (ikon Buku).
2. Di sini Anda akan melihat rentang minggu saat ini (Senin - Minggu).
3. Upload maksimal 3 foto dokumentasi kegiatan. Tap/klik pada **Foto 1, 2, atau 3**.
4. Tuliskan deskripsi/kegiatan yang Anda kerjakan minggu ini di kolom Keterangan.
5. Klik **Kirim Jurnal Minggu Ini**.
6. *Catatan:* Anda hanya dapat mengirim jurnal 1 kali dalam 1 minggu. Jika Anda ingin merevisi atau mengubah foto, klik tombol **Hapus & Upload Ulang** pada jurnal tersebut.

### E. Melihat Riwayat & Cetak Bukti
- Tab **Riwayat**: Untuk melihat rekap absen pada bulan tertentu atau semua bulan. Terdapat tombol berlogo printer di pojok kanan atas jika Anda ingin mencetak PDF/struk absen sebagai bukti harian.

---

## 3. Panduan Untuk Guru (Pembimbing PSG)

Aplikasi Guru juga mendukung PWA dan sangat disarankan untuk diinstal agar pemantauan lebih mudah.

### A. Cara Instalasi Portal Guru
Pemasangannya sama dengan aplikasi siswa:
1. Buka link **[https://skagamu.github.io/monitoring-absensi-psg/](https://skagamu.github.io/monitoring-absensi-psg/)** menggunakan Chrome (Android) atau Safari (iPhone).
2. Lakukan langkah **Tambahkan ke Layar Utama** (Add to Home screen).
3. Buka ikon aplikasi dari layar HP Anda.

### B. Cara Login
1. Buka aplikasi portal guru SKAGAMU.
2. Masukkan **ID Pembimbing** dan **Kata Sandi (Secret)** yang diberikan oleh sekolah/Admin.
3. Klik Masuk.

### C. Membaca Dashboard & Info PSG
1. Pada menu **Dashboard**, Anda akan disuguhkan total anak bimbingan Anda beserta status mereka hari ini secara _real-time_.
2. Di bagian bawah Dashboard, terdapat ringkasan informasi terkait tempat instansi PSG dari siswa bimbingan, lengkap dengan alamat dan kontak pembimbing instansi.

### D. Memantau Absensi (Harian & Periodik)
1. **Menu Harian:** Untuk mengecek secara rinci siapa saja siswa bimbingan yang Hadir, Izin, Sakit, atau Belum Absen pada hari ini. Anda bisa mencari berdasarkan nama siswa.
2. **Menu Rekap Tabel:** Menyajikan data seperti rapor kehadiran. Anda bisa melihat rekapitulasi Mingguan, Bulanan, maupun Total (Semua Waktu).
3. **Menu Detail Siswa:** Berguna jika Anda ingin menelusuri secara mendalam rekam jejak harian untuk 1 siswa spesifik pada bulan tertentu. Menu ini juga bisa dipakai untuk export PDF sebagai laporan bimbingan guru.

### E. Mengecek Jurnal Siswa
1. Buka menu tab **Jurnal**.
2. Anda bisa memfilter berdasarkan "Semua Siswa" atau memilih salah satu nama anak didik.
3. Jurnal akan ditampilkan berurutan dari minggu terbaru. 
4. Anda dapat mengklik foto jurnal untuk memperbesar, dan mengklik tombol unduh jika ingin menyimpan dokumentasi kegiatan siswa tersebut.
