const fetch = require('node-fetch');

async function run() {
  const url = "https://script.google.com/macros/s/AKfycbyZYfk70rs-WOOHQeq4RR93VtdzcpvTIk4aMv2rKUgFqGJ6RiOReb2QNnMbNZUp5fkLwg/exec";
  
  console.log("1. Submitting Absen...");
  const payload = {
    action: "absen",
    nisn: "1001",
    lat: -6.2,
    lng: 106.8,
    status: "Izin",
    alasan: "Test API",
    photoBase64: null,
    gpsHistory: []
  };
  
  let res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  console.log(await res.text());

  console.log("\n2. Fetching Siswa Rekap...");
  res = await fetch(`${url}?action=getRekap&nisn=1001&bulan=all`);
  let data = await res.json();
  console.log("Total Siswa Data:", data.data ? data.data.length : 0);
  console.log("First item:", data.data ? data.data[0] : null);

  console.log("\n3. Fetching Guru Rekap...");
  res = await fetch(`${url}?action=getRekapGuru&namaGuru=Budi Santoso&bulan=all`);
  data = await res.json();
  console.log("Total Guru Data:", data.data ? data.data.length : 0);
  console.log("First item:", data.data ? data.data[0] : null);
}
run();
