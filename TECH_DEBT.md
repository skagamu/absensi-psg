# Technical Debt & Known Issues

## Jurnal Harian: Upload Foto Base64
1. **Batasan Upload:** Batasan jumlah upload foto di jurnal harian telah dihapus.
2. **Mekanisme Pengiriman:** Pengiriman foto diubah menjadi sekuensial (satu per satu) untuk mencegah Out of Memory (OOM) pada device.
3. **Peringatan Kritis:** Foto saat ini disimpan dalam bentuk string Base64 dan dikirim ke Google Apps Script (lalu ke Google Sheet). Menumpuk terlalu banyak foto Base64 akan sangat memperlambat dan membebani performa Google Sheet di masa depan.
4. **Rekomendasi Perbaikan:** Migrasi penyimpanan file (blob) secara langsung ke Google Drive API. Google Sheet hanya menyimpan tautan (URL) atau ID dari file tersebut.
