const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzJWdUPFWpuGEm6jY1cVsgUr-h1S9qAewQxDPxn3R9vkEQ9I8tnPaItJDchdt_TAE2blg/exec";

// DOM Elements
const sectionLogin = document.getElementById('loginSection');
const mainApp = document.getElementById('mainApp');
const inputNisn = document.getElementById('inputNisn');
const inputTglLahir = document.getElementById('inputTglLahir');
const btnLanjut = document.getElementById('btnLanjut');

const userProfile = document.getElementById('userProfile');
const displayNisn = document.getElementById('displayNisn');
const displayNamaLengkap = document.getElementById('displayNamaLengkap');
const btnProfileMenu = document.getElementById('btnProfileMenu');
const dropdownMenu = document.getElementById('dropdownMenu');
const loadingOverlay = document.getElementById('loadingOverlay');

// Camera & Absen Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photo');
const btnCapture = document.getElementById('btnCapture');
const btnRetake = document.getElementById('btnRetake');
const btnSubmit = document.getElementById('btnSubmit');
const cameraStatus = document.getElementById('cameraStatus');
const locDot = document.getElementById('locDot');
const locText = document.getElementById('locText');

const inputStatus = document.getElementById('inputStatus');
const inputAlasan = document.getElementById('inputAlasan');
const boxAlasan = document.getElementById('boxAlasan');

// Rekap Elements
const bulanRekap = document.getElementById('bulanRekap');
const rekapContainer = document.getElementById('rekapContainer');
const btnExportPdf = document.getElementById('btnExportPdf');

// Dashboard Elements
const dashNamaSiswa = document.getElementById('dashNamaSiswa');
const dashStatusHariIni = document.getElementById('dashStatusHariIni');
const dashBulanFilter = document.getElementById('dashBulanFilter');
const dashH = document.getElementById('dashH');
const dashS = document.getElementById('dashS');
const dashI = document.getElementById('dashI');
const dashA = document.getElementById('dashA');

// State
let userData = { nisn: '', nama: '', lat: null, lng: null, photoBase64: null };
let stream = null;
let currentTab = 'dashboard';
let rekapDataCache = [];
let pengaturanCache = { tglMulai: '', tglSelesai: '', libur: [] };
let gpsInterval = null;
let gpsHistory = [];
let gpsLoopId = 0;

// Utilities
const parseDate = (str) => {
    const parts = str.split('/');
    if (parts.length !== 3) return new Date();
    return new Date(parts[2], parts[1] - 1, parts[0]);
};
const getTodayStr = () => {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
};
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = deg2rad(lat2-lat1);
    var dLon = deg2rad(lon2-lon1); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}
function deg2rad(deg) { return deg * (Math.PI/180); }

// Init
window.onload = () => {
    const savedNisn = localStorage.getItem('nisn_pkl');
    const savedNama = localStorage.getItem('nama_pkl');
    if (savedNisn) {
        setLoggedInState(savedNisn, savedNama || savedNisn);
    }
};

function setLoggedInState(nisn, nama) {
    userData.nisn = nisn;
    userData.nama = nama;
    const namaDepan = nama ? nama.split(' ')[0] : nisn;
    displayNisn.innerText = namaDepan;
    displayNamaLengkap.innerText = nama;
    dashNamaSiswa.innerText = nama;
    
    userProfile.style.display = 'flex';
    sectionLogin.style.display = 'none';
    mainApp.style.display = 'flex';
    
    switchTab('dashboard');
    fetchRekap(nisn);
    fetchJurnal(nisn);
}

// Login Process
btnLanjut.addEventListener('click', async () => {
    const nisn = inputNisn.value.trim();
    const tglLahirRaw = inputTglLahir.value;
    if (!nisn || !tglLahirRaw) return showToast("Mohon masukkan NIS dan PIN/Password", "error");

    const originalText = btnLanjut.innerHTML;
    btnLanjut.innerHTML = `<div class="spinner w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> Memverifikasi...`;
    btnLanjut.disabled = true;

    try {
        const payload = { action: "login", nisn: nisn, tglLahir: tglLahirRaw };
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            localStorage.setItem('nisn_pkl', nisn);
            if (result.nama) localStorage.setItem('nama_pkl', result.nama);
            showToast("Login Berhasil!");
            setLoggedInState(nisn, result.nama || nisn);
        } else {
            showToast(result.message, "error");
        }
    } catch (e) {
        showToast("Koneksi gagal saat memverifikasi.", "error");
    } finally {
        btnLanjut.innerHTML = originalText;
        btnLanjut.disabled = false;
    }
});

// Logout & Menu
document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('nisn_pkl');
    localStorage.removeItem('nama_pkl');
    window.location.reload();
});

if (btnProfileMenu && dropdownMenu) {
    btnProfileMenu.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenu.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
        if (!btnProfileMenu.contains(e.target) && !dropdownMenu.contains(e.target)) dropdownMenu.classList.add('hidden');
    });
}

// Tabs Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const nextTab = e.currentTarget.getAttribute('data-target');
        
        if (currentTab === 'absen' && nextTab !== 'absen') {
            stopCamera();
            if (gpsInterval) clearTimeout(gpsInterval);
        }
        if (nextTab === 'absen' && currentTab !== 'absen') { 
            initCamera(); 
            getLocation(); 
            renderKehadiran();
        }
        
        currentTab = nextTab;
        switchTab(currentTab);
        if(currentTab === 'dashboard') renderDashboard();
        else if(currentTab === 'rekap') renderRekap();
        else if(currentTab === 'jurnal') renderJurnal();
    });
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => { c.classList.add('hidden'); c.classList.remove('flex'); });
    const target = document.getElementById('tab-' + tabId);
    if(target) { target.classList.remove('hidden'); target.classList.add('flex'); }
}

// Fetch Data (Rekap & Dashboard)
async function fetchRekap(nisn) {
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getRekap&nisn=${nisn}&bulan=all`);
        const result = await res.json();
        if (result.status === 'success') {
            rekapDataCache = result.data || [];
            pengaturanCache = result.pengaturan || { tglMulai: '', tglSelesai: '', libur: [] };
            
            // Save PSG Location
            userData.psgLat = result.psgLat ? parseFloat(result.psgLat.toString().replace(',', '.')) : null;
            userData.psgLng = result.psgLng ? parseFloat(result.psgLng.toString().replace(',', '.')) : null;
            userData.lokasiPKL = result.lokasiPKL;

            renderDashboard();
            renderRekap();
            renderKehadiran();
        }
    } catch (e) { console.error("Gagal load rekap", e); }
}

function isWorkingDay(dateStr) {
    if (!pengaturanCache.tglMulai) return true;
    let d = parseDate(dateStr); d.setHours(0,0,0,0);
    let start = parseDate(pengaturanCache.tglMulai); start.setHours(0,0,0,0);
    let end = pengaturanCache.tglSelesai ? parseDate(pengaturanCache.tglSelesai) : new Date(2100,0,1); end.setHours(23,59,59,999);
    let now = new Date(); now.setHours(23,59,59,999);
    
    if (d < start || d > end || d > now) return false;
    let day = d.getDay();
    if (day === 0 || day === 6) return false;
    if (pengaturanCache.libur.includes(dateStr)) return false;
    return true;
}

function renderDashboard() {
    const todayStr = getTodayStr();
    const todayRecord = rekapDataCache.find(r => r.tanggal === todayStr);
    
    const btnCancelAbsen = document.getElementById('btnCancelAbsen');
    if (todayRecord) {
        dashStatusHariIni.innerText = `${todayRecord.status} pukul ${todayRecord.waktu}`;
        dashStatusHariIni.className = `font-bold text-sm ${todayRecord.status === 'Hadir' ? 'text-emerald-500' : 'text-amber-500'}`;
        if (btnCancelAbsen) btnCancelAbsen.classList.remove('hidden');
    } else {
        dashStatusHariIni.innerText = "Belum Absen";
        dashStatusHariIni.className = "font-bold text-sm text-slate-400";
        if (btnCancelAbsen) btnCancelAbsen.classList.add('hidden');
    }

    const dashStatusAgenda = document.getElementById('dashStatusAgenda');
    if (todayRecord && todayRecord.agenda && todayRecord.agenda.trim() !== '') {
        dashStatusAgenda.innerText = "Sudah terisi";
        dashStatusAgenda.className = "text-xs font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-200";
    } else {
        dashStatusAgenda.innerText = "Belum terisi";
        dashStatusAgenda.className = "text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200";
    }

    const weekId = getWeekId(new Date());
    const dashStatusDokumentasi = document.getElementById('dashStatusDokumentasi');
    const currentWeekEntry = jurnalDataCache.find(j => j.weekId === weekId);
    if (currentWeekEntry) {
        const c = currentWeekEntry.photoCount || 0;
        if (c >= 2) {
            dashStatusDokumentasi.innerText = "Sudah terisi 2 foto";
            dashStatusDokumentasi.className = "text-xs font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-200";
        } else {
            dashStatusDokumentasi.innerText = "Baru satu foto";
            dashStatusDokumentasi.className = "text-xs font-bold px-2 py-1 rounded bg-amber-50 text-amber-600 border border-amber-200";
        }
    } else {
        dashStatusDokumentasi.innerText = "Belum terisi";
        dashStatusDokumentasi.className = "text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200";
    }

    const filter = dashBulanFilter.value;
    let H=0, S=0, I=0, A=0;
    
    let workingDatesCount = 0;
    if (pengaturanCache.tglMulai) {
        let startD = parseDate(pengaturanCache.tglMulai);
        let endD = pengaturanCache.tglSelesai ? parseDate(pengaturanCache.tglSelesai) : new Date();
        let nowD = new Date();
        if (endD > nowD) endD = nowD;
        
        for(let curr = new Date(startD); curr <= endD; curr.setDate(curr.getDate()+1)) {
            if (filter !== 'all' && (curr.getMonth() + 1).toString() !== filter) continue;
            let currStr = `${curr.getDate().toString().padStart(2,'0')}/${(curr.getMonth()+1).toString().padStart(2,'0')}/${curr.getFullYear()}`;
            if (isWorkingDay(currStr)) workingDatesCount++;
        }
    }
    
    rekapDataCache.forEach(item => {
        const d = parseDate(item.tanggal);
        if (filter === 'all' || (d.getMonth() + 1) == filter) {
            if (item.status === 'Hadir') H++;
            else if (item.status === 'Sakit') S++;
            else if (item.status === 'Izin') I++;
        }
    });

    if (pengaturanCache.tglMulai) {
        A = Math.max(0, workingDatesCount - (H + S + I));
    }

    dashH.innerText = H; dashS.innerText = S; dashI.innerText = I; dashA.innerText = A;
}
dashBulanFilter.addEventListener('change', renderDashboard);

function renderRekap() {
    const filter = bulanRekap.value;
    let filtered = rekapDataCache;
    if (filter !== 'all') {
        filtered = rekapDataCache.filter(item => {
            const d = parseDate(item.tanggal);
            return (d.getMonth() + 1) == filter;
        });
    }

    if (!filtered.length) {
        rekapContainer.innerHTML = `<div class="text-center text-slate-400 text-sm py-10 font-medium bg-white rounded-xl border border-slate-200">Tidak ada riwayat.</div>`;
        return;
    }

    let html = '';
    filtered.forEach(item => {
        let badgeColor = item.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            item.status === 'Izin' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';
            
        let fotoUrl = item.foto;
        if (fotoUrl && fotoUrl.includes('drive.google.com/file/d/')) {
            const match = fotoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) fotoUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w120`;
        }

        html += `
        <div class="bg-white border border-slate-200 shadow-sm rounded-xl p-3 flex gap-3 items-center">
            ${fotoUrl ? `<img src="${fotoUrl}" class="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQ3NTU2OSIgZD0iTTEyIDJDMiAyIDIgMTIgMiAxMnMyIDEwIDEwIDEwIDEwLTEwIDEwLTEwUzIyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6Ii8+PC9zdmc+'" />` : '<div class="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0"><i class="ph ph-image text-slate-300"></i></div>'}
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-0.5">
                    <span class="text-slate-800 font-semibold text-sm truncate">${item.tanggal}</span>
                    <span class="text-[10px] border px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${badgeColor}">${item.status}</span>
                </div>
                <div class="text-slate-500 text-xs font-medium truncate">${item.waktu} ${item.alasan ? '• ' + item.alasan : ''} ${item.agenda ? '• Agenda: ' + item.agenda : ''}</div>
            </div>
        </div>`;
    });
    rekapContainer.innerHTML = html;
}
bulanRekap.addEventListener('change', renderRekap);
btnExportPdf.addEventListener('click', () => window.print());

function updateSubmitVisibility() {
    const selectedStatus = inputStatus.value;
    let isAppropriateLocation = true; 
    
    if (selectedStatus === 'Hadir') {
        if (userData.psgLat && userData.psgLng) {
            if (!userData.lat || !userData.lng) {
                isAppropriateLocation = false; 
            } else {
                const d = getDistanceFromLatLonInM(userData.lat, userData.lng, userData.psgLat, userData.psgLng);
                if (d > 50) isAppropriateLocation = false;
            }
        } else {
            if (!userData.lat || !userData.lng) {
                isAppropriateLocation = false; 
            }
        }
    }

    if (!isAppropriateLocation) {
        btnSubmit.classList.add('hidden');
    } else {
        btnSubmit.classList.remove('hidden');
    }
}

// Absen Logic (Camera, GPS, Form)
inputStatus.addEventListener('change', (e) => {
    if (e.target.value === 'Sakit' || e.target.value === 'Izin') { boxAlasan.classList.remove('hidden'); }
    else { boxAlasan.classList.add('hidden'); inputAlasan.value = ''; }
    updateSubmitVisibility();
});

async function initCamera() {
    try {
        cameraStatus.style.display = 'flex';
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        video.srcObject = stream;
        video.onloadedmetadata = () => { cameraStatus.style.display = 'none'; btnCapture.disabled = false; btnCapture.classList.remove('opacity-50'); };
    } catch (err) {
        cameraStatus.innerHTML = `<i class="ph ph-camera-slash text-2xl mb-1 text-rose-400"></i><p class="font-bold text-sm">Akses Kamera Ditolak</p>`;
        showToast("Izinkan akses kamera di browser Anda.", "error");
    }
}
function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
}

function getLocation() {
    if (navigator.geolocation) {
        locDot.classList.remove('bg-emerald-500', 'bg-rose-500', 'bg-amber-500');
        locDot.classList.add('bg-amber-500');
        locText.innerText = "Mencari GPS...";
        gpsHistory = [];
        if (gpsInterval) {
            clearTimeout(gpsInterval);
            gpsInterval = null;
        }
        
        gpsLoopId++;
        const currentLoopId = gpsLoopId;

        const fetchLocation = () => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (currentLoopId !== gpsLoopId) return;
                    
                    const lat = pos.coords.latitude; 
                    const lng = pos.coords.longitude;
                    userData.lat = lat; userData.lng = lng;

                    gpsHistory.push({ lat, lng });
                    if (gpsHistory.length > 5) gpsHistory.shift();

                    const progressContainer = document.getElementById('gpsProgressContainer');
                    const progressBar = document.getElementById('gpsProgressBar');
                    if (progressContainer && progressBar) {
                        if (gpsHistory.length < 3) {
                            progressContainer.classList.remove('hidden');
                            progressBar.style.width = `${(gpsHistory.length / 3) * 100}%`;
                        } else {
                            progressBar.style.width = '100%';
                            setTimeout(() => progressContainer.classList.add('hidden'), 300);
                        }
                    }

                    locDot.classList.remove('bg-amber-500', 'bg-emerald-500', 'bg-rose-500');
                    if (userData.psgLat && userData.psgLng) {
                        const d = getDistanceFromLatLonInM(lat, lng, userData.psgLat, userData.psgLng);
                        if (d > 50) {
                            locDot.classList.add('bg-rose-500');
                            locText.innerText = `Jarak ${Math.round(d)}m (Di Luar Radius)`;
                        } else {
                            locDot.classList.add('bg-emerald-500');
                            locText.innerText = `Jarak ${Math.round(d)}m (Sesuai Radius)`;
                        }
                    } else {
                        locDot.classList.add('bg-emerald-500');
                        locText.innerText = `Akurasi ${pos.coords.accuracy.toFixed(0)}m`;
                    }
                    locDot.classList.remove('animate-pulse');
                    updateSubmitVisibility();
                    gpsInterval = setTimeout(fetchLocation, 2500);
                },
                (err) => { 
                    if (currentLoopId !== gpsLoopId) return;
                    
                    locDot.classList.remove('bg-amber-500', 'bg-emerald-500', 'bg-rose-500');
                    locDot.classList.add('bg-rose-500'); 
                    locText.innerText = "GPS Gagal"; 
                    updateSubmitVisibility(); 
                    gpsInterval = setTimeout(fetchLocation, 2500);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        };
        fetchLocation();
    }
}

btnCapture.addEventListener('click', () => {
    const MAX_WIDTH = 480;
    let width = video.videoWidth, height = video.videoHeight;
    if (width > MAX_WIDTH) { height = height * (MAX_WIDTH / width); width = MAX_WIDTH; }
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    userData.photoBase64 = canvas.toDataURL('image/jpeg', 0.3);

    video.classList.add('hidden');
    photoPreview.src = userData.photoBase64; photoPreview.classList.remove('hidden');
    
    btnCapture.classList.add('hidden');
    btnRetake.classList.remove('hidden');
    
    btnSubmit.disabled = false;
    btnSubmit.className = "w-full bg-primary hover:bg-blue-900 active:scale-95 text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all shadow-sm mt-2";
    btnSubmit.innerHTML = `Kirim Absensi Sekarang <i class="ph ph-paper-plane-right font-bold text-lg"></i>`;
    updateSubmitVisibility();
});

btnRetake.addEventListener('click', () => {
    userData.photoBase64 = null;
    photoPreview.classList.add('hidden'); video.classList.remove('hidden');
    btnRetake.classList.add('hidden'); btnCapture.classList.remove('hidden');
    
    btnSubmit.disabled = true;
    btnSubmit.className = "w-full bg-slate-300 text-slate-500 font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all mt-2";
    btnSubmit.innerHTML = `Silakan Ambil Foto <i class="ph ph-camera text-lg"></i>`;
    updateSubmitVisibility();
});

// ===== JURNAL MINGGUAN LOGIC =====
let jurnalPhotos = [null, null, null]; // base64 data for 3 slots
let visibleJurnalSlots = 1;
let jurnalDataCache = []; // cached jurnal entries from server

// Get current week's Monday and Sunday (Mon 00:00 - Sun 23:59)
function getCurrentWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday };
}

function getWeekId(date) {
    // Generate a unique week ID based on the Monday of that week
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    d.setHours(0, 0, 0, 0);
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

function formatDateIndo(date) {
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function handleJurnalFileSelect(input, slotNum) {
    const file = input.files[0];
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast("Ukuran file maksimal 5MB!", "error");
        input.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Compress image
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_W = 800;
            let w = img.width, h = img.height;
            if (w > MAX_W) { h = h * (MAX_W / w); w = MAX_W; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.5);
            
            jurnalPhotos[slotNum - 1] = compressed;
            
            // Update slot UI
            const slot = document.getElementById(`jurnalSlot${slotNum}`);
            const content = document.getElementById(`jurnalSlot${slotNum}Content`);
            slot.classList.add('has-image');
            content.innerHTML = `
                <img src="${compressed}" class="jurnal-img-preview" alt="Foto ${slotNum}">
                <div class="flex items-center justify-between mt-2 px-1">
                    <span class="text-xs font-semibold text-emerald-600 flex items-center gap-1"><i class="ph-fill ph-check-circle"></i> Foto ${slotNum}</span>
                    <button onclick="event.stopPropagation(); removeJurnalPhoto(${slotNum})" class="text-xs text-rose-500 font-semibold hover:text-rose-700 flex items-center gap-1">
                        <i class="ph ph-trash"></i> Hapus
                    </button>
                </div>
            `;
            updateJurnalUploadCount();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeJurnalPhoto(slotNum) {
    jurnalPhotos[slotNum - 1] = null;
    const slot = document.getElementById(`jurnalSlot${slotNum}`);
    const content = document.getElementById(`jurnalSlot${slotNum}Content`);
    const fileInput = document.getElementById(`jurnalFile${slotNum}`);
    
    slot.classList.remove('has-image');
    content.innerHTML = `
        <i class="ph ph-image-square text-3xl text-slate-400 mb-1"></i>
        <p class="text-sm font-semibold text-slate-500">Foto ${slotNum}</p>
        <p class="text-xs text-slate-400">Tap untuk upload</p>
    `;
    fileInput.value = '';
    updateJurnalUploadCount();
}

function updateJurnalUploadCount() {
    const count = jurnalPhotos.filter(p => p !== null).length;
    const countEl = document.getElementById('jurnalUploadCount');
    const progressBar = document.getElementById('jurnalProgressBar');
    const progressText = document.getElementById('jurnalProgressText');
    
    let colorClass = 'bg-slate-400';
    let countElBg = 'bg-slate-100';
    let countElText = 'text-slate-500';
    
    if (count === 1) { colorClass = 'bg-amber-400'; countElBg = 'bg-amber-100'; countElText = 'text-amber-600'; }
    else if (count === 2) { colorClass = 'bg-emerald-400'; countElBg = 'bg-emerald-100'; countElText = 'text-emerald-600'; }
    else if (count >= 3) { colorClass = 'bg-rose-500'; countElBg = 'bg-rose-100'; countElText = 'text-rose-600'; }
    
    if (countEl) {
        countEl.innerText = `${count}/2 foto`;
        countEl.className = `text-xs font-bold px-2 py-1 rounded-lg ${countElBg} ${countElText}`;
    }
    if (progressBar) {
        progressBar.style.width = `${Math.min((count / 2) * 100, 100)}%`;
        progressBar.className = `jurnal-status-fill ${colorClass}`;
    }
    if (progressText) {
        progressText.innerText = `${count}/2`;
    }
}

window.tambahSlotJurnal = function() {
    if (visibleJurnalSlots < 3) {
        visibleJurnalSlots++;
        const slotEl = document.getElementById(`slotContainer${visibleJurnalSlots}`);
        if (slotEl) {
            slotEl.classList.remove('hidden');
        }
        if (visibleJurnalSlots >= 3) {
            document.getElementById('btnAddSlot').classList.add('hidden');
        }
    }
}

window.editJurnal = function(id) {
    const entry = jurnalDataCache.find(j => j.id === id);
    if (!entry) return;
    
    document.getElementById('jurnalSuccessContainer').classList.add('hidden');
    document.getElementById('jurnalUploadSection').classList.remove('hidden');
    
    let ketParsed = ["", "", ""];
    if (entry.keterangan) {
        const lines = entry.keterangan.split('\n\n');
        for (let line of lines) {
            if (line.startsWith('Foto 1: ')) ketParsed[0] = line.substring(8);
            else if (line.startsWith('Foto 2: ')) ketParsed[1] = line.substring(8);
            else if (line.startsWith('Foto 3: ')) ketParsed[2] = line.substring(8);
            else ketParsed[0] += (ketParsed[0] ? "\n" : "") + line;
        }
    }
    
    jurnalPhotos = [null, null, null];
    visibleJurnalSlots = entry.photoUrls.length || 1;
    if (visibleJurnalSlots > 3) visibleJurnalSlots = 3;
    
    for (let i = 1; i <= 3; i++) {
        const slotC = document.getElementById(`slotContainer${i}`);
        if (i <= visibleJurnalSlots) {
            if (slotC) slotC.classList.remove('hidden');
            const url = entry.photoUrls[i-1];
            if (url) {
                jurnalPhotos[i-1] = url;
                const slot = document.getElementById(`jurnalSlot${i}`);
                const content = document.getElementById(`jurnalSlot${i}Content`);
                slot.classList.add('has-image');
                content.innerHTML = `
                    <img src="${url}" class="jurnal-img-preview" alt="Foto ${i}">
                    <div class="flex items-center justify-between mt-2 px-1">
                        <span class="text-xs font-semibold text-emerald-600 flex items-center gap-1"><i class="ph-fill ph-check-circle"></i> Foto Lama</span>
                        <button onclick="event.stopPropagation(); removeJurnalPhoto(${i})" class="text-xs text-rose-500 font-semibold hover:text-rose-700 flex items-center gap-1">
                            <i class="ph ph-trash"></i> Hapus
                        </button>
                    </div>
                `;
            }
        } else {
            if (slotC) slotC.classList.add('hidden');
        }
        
        const ketEl = document.getElementById(`jurnalKeterangan${i}`);
        if (ketEl) ketEl.value = ketParsed[i-1];
    }
    
    if (visibleJurnalSlots >= 3) {
        document.getElementById('btnAddSlot').classList.add('hidden');
    } else {
        document.getElementById('btnAddSlot').classList.remove('hidden');
    }
    
    updateJurnalUploadCount();
    
    const btnSubmit = document.getElementById('btnSubmitJurnal');
    btnSubmit.dataset.editId = id;
    btnSubmit.innerHTML = `<i class="ph ph-pencil-simple text-lg font-bold"></i> Simpan Perubahan`;
};

async function submitJurnal() {
    const photos = [];
    const ketLines = [];
    
    for (let i = 1; i <= visibleJurnalSlots; i++) {
        let p = jurnalPhotos[i-1];
        let ketEl = document.getElementById(`jurnalKeterangan${i}`);
        let ket = ketEl ? ketEl.value.trim() : "";
        
        // If a slot has either a photo or text, require BOTH
        if (p || ket) {
            if (!p) return showToast(`Mohon upload Foto pada slot ${i}!`, "error");
            if (!ket) return showToast(`Mohon isi keterangan untuk Foto pada slot ${i}!`, "error");
            
            photos.push(p);
            ketLines.push(`Foto ${photos.length}: ${ket}`);
        }
    }
    
    if (photos.length === 0) {
        return showToast("Mohon upload setidaknya 1 dokumentasi!", "error");
    }
    
    const keterangan = ketLines.join('\n\n');
    
    const { monday, sunday } = getCurrentWeekRange();
    const weekId = getWeekId(new Date());
    
    const btn = document.getElementById('btnSubmitJurnal');
    const isEditMode = !!btn.dataset.editId;
    const editId = btn.dataset.editId;
    
    // Check if already submitted this week (only if NOT editing)
    if (!isEditMode) {
        const existingEntry = jurnalDataCache.find(j => j.weekId === weekId);
        if (existingEntry) {
            return showToast("Jurnal minggu ini sudah dikirim!", "error");
        }
    }
    
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> Menyimpan...`;
    loadingOverlay.classList.remove('hidden');
    
    try {
        const payload = {
            action: isEditMode ? "editJurnal" : "submitJurnal",
            id: isEditMode ? editId : undefined,
            nisn: userData.nisn,
            weekId: weekId,
            weekStart: `${monday.getDate().toString().padStart(2,'0')}/${(monday.getMonth()+1).toString().padStart(2,'0')}/${monday.getFullYear()}`,
            weekEnd: `${sunday.getDate().toString().padStart(2,'0')}/${(sunday.getMonth()+1).toString().padStart(2,'0')}/${sunday.getFullYear()}`,
            keterangan: keterangan,
            photos: photos // Array of base64 strings or URLs
        };
        
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await res.json();
             if (result.status === 'success') {
            showToast(isEditMode ? "Dokumentasi berhasil diperbarui! 🎉" : "Dokumentasi berhasil dikirim! 🎉");
            // Reset form
            jurnalPhotos = [null, null, null];
            visibleJurnalSlots = 1;
            for (let i = 1; i <= 3; i++) {
                removeJurnalPhoto(i);
                let ketEl = document.getElementById(`jurnalKeterangan${i}`);
                if(ketEl) ketEl.value = '';
                if(i > 1) {
                    let slotC = document.getElementById(`slotContainer${i}`);
                    if(slotC) slotC.classList.add('hidden');
                }
            }
            document.getElementById('btnAddSlot').classList.remove('hidden');
            delete btn.dataset.editId;
            btn.innerHTML = `<i class="ph ph-paper-plane-right text-lg font-bold"></i> Kirim Dokumentasi Mingguan`;
            
            // Refresh data
            fetchJurnal(userData.nisn);
        } else {
            showToast(result.message, "error");
            btn.disabled = false;
            btn.innerHTML = isEditMode ? `<i class="ph ph-pencil-simple text-lg font-bold"></i> Simpan Perubahan` : `<i class="ph ph-paper-plane-right text-lg font-bold"></i> Kirim Dokumentasi Mingguan`;
        }
    } catch (e) {
        showToast("Koneksi gagal. Coba lagi.", "error");
        btn.disabled = false;
        btn.innerHTML = isEditMode ? `<i class="ph ph-pencil-simple text-lg font-bold"></i> Simpan Perubahan` : `<i class="ph ph-paper-plane-right text-lg font-bold"></i> Kirim Dokumentasi Mingguan`;
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

async function fetchJurnal(nisn) {
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getJurnal&nisn=${nisn}`);
        const result = await res.json();
        if (result.status === 'success') {
            jurnalDataCache = result.data || [];
            renderJurnal();
            renderDashboard();
        }
    } catch (e) {
        console.error("Gagal load jurnal", e);
    }
}

function renderKehadiran() {
    const todayStr = getTodayStr();
    const todayRecord = rekapDataCache.find(r => r.tanggal === todayStr);
    const formContainer = document.getElementById('absenFormContainer');
    const successContainer = document.getElementById('absenSuccessContainer');
    
    if (todayRecord) {
        if(formContainer) { formContainer.classList.add('hidden'); formContainer.classList.remove('flex'); }
        if(successContainer) { successContainer.classList.remove('hidden'); successContainer.classList.add('flex'); }
        stopCamera();
        renderAgendaHarian(todayRecord);
    } else {
        if(formContainer) { formContainer.classList.remove('hidden'); formContainer.classList.add('flex'); }
        if(successContainer) { successContainer.classList.add('hidden'); successContainer.classList.remove('flex'); }
    }
}

function renderAgendaHarian(todayRecord) {
    const agendaContent = document.getElementById('agendaContent');
    if (!agendaContent) return;
    
    if (todayRecord.status !== 'Hadir') {
        agendaContent.innerHTML = `<div class="text-center py-4 bg-slate-50 rounded-xl border border-slate-100"><i class="ph ph-info text-2xl text-blue-500 mb-1"></i><p class="text-sm font-medium text-slate-500">Status Anda hari ini: ${todayRecord.status}.<br>Tidak perlu mengisi jurnal harian.</p></div>`;
    } else {
        let currentText = todayRecord.agenda || "";
        agendaContent.innerHTML = `
            <p class="text-xs text-slate-500 mb-2">Silakan isi atau ubah kegiatan Anda hari ini.</p>
            <textarea id="inputAgendaHarianBaru" placeholder="Tuliskan deskripsi kegiatan hari ini..." class="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 outline-none focus:border-primary focus:bg-white transition-all resize-none h-24 mb-2">${currentText}</textarea>
            <button id="btnSubmitAgenda" onclick="submitAgendaHarian()" class="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-sm">
                <i class="ph ph-check-circle text-lg font-bold"></i> Simpan Jurnal Harian
            </button>
        `;
    }
}

function renderJurnal() {
    const { monday, sunday } = getCurrentWeekRange();
    const weekId = getWeekId(new Date());
    
    // Update week range display
    const rangeEl = document.getElementById('jurnalWeekRange');
    if (rangeEl) {
        rangeEl.innerText = `${formatDateIndo(monday)} — ${formatDateIndo(sunday)}`;
    }
    
    // Check if current week already submitted
    const currentWeekEntry = jurnalDataCache.find(j => j.weekId === weekId);
    const uploadSection = document.getElementById('jurnalUploadSection');
    const successContainer = document.getElementById('jurnalSuccessContainer');
    
    if (currentWeekEntry) {
        if(uploadSection) uploadSection.classList.add('hidden');
        if(successContainer) {
            successContainer.classList.remove('hidden');
            successContainer.innerHTML = `
                <div class="text-center py-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div class="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <i class="ph-fill ph-check-circle text-4xl text-emerald-500"></i>
                    </div>
                    <h3 class="text-lg font-bold text-slate-800 mb-1">Jurnal Terkirim!</h3>
                    <p class="text-sm text-slate-500">Jurnal minggu ini sudah berhasil dikirim pada ${currentWeekEntry.waktu || 'sebelumnya'}.</p>
                    <p class="text-xs text-slate-400 mt-2">${currentWeekEntry.photoCount || 0} foto • ${currentWeekEntry.keterangan ? currentWeekEntry.keterangan.substring(0, 60) + '...' : ''}</p>
                    <div class="flex items-center justify-center gap-3 mt-4">
                        <button onclick="editJurnal('${currentWeekEntry.id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border border-blue-200">
                            <i class="ph ph-pencil-simple text-lg"></i> Edit
                        </button>
                        <button onclick="deleteJurnal('${currentWeekEntry.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border border-rose-200">
                            <i class="ph ph-trash text-lg"></i> Hapus
                        </button>
                    </div>
                </div>
            `;
        }
        // Update progress
        const count = currentWeekEntry.photoCount || 0;
        const progressBar = document.getElementById('jurnalProgressBar');
        const progressText = document.getElementById('jurnalProgressText');
        if (progressBar) progressBar.style.width = `${(count / 2) * 100}%`;
        if (progressText) progressText.innerText = `${count}/2`;
    } else {
        if(successContainer) successContainer.classList.add('hidden');
        if(uploadSection) uploadSection.classList.remove('hidden');
        updateJurnalUploadCount();
    }
    
    // Render history
    const historyContainer = document.getElementById('jurnalHistory');
    if (!jurnalDataCache.length) {
        historyContainer.innerHTML = `<div class="text-center text-slate-400 text-sm py-6 font-medium bg-white rounded-xl border border-slate-200">Belum ada riwayat jurnal.</div>`;
        return;
    }
    
    // Sort by weekId descending (newest first)
    const sorted = [...jurnalDataCache].sort((a, b) => b.weekId.localeCompare(a.weekId));
    
    let html = '';
    sorted.forEach((entry, idx) => {
        const isCurrentWeek = entry.weekId === weekId;
        const photoCount = entry.photoCount || 0;
        const progressPct = Math.round((photoCount / 2) * 100);
        const progressColor = photoCount >= 2 ? 'bg-emerald-500' : 'bg-amber-500';
        
        // Build photo gallery HTML
        let photosHtml = '';
        const photoUrls = entry.photoUrls || [];
        if (photoUrls.length > 0) {
            photosHtml = `<div class="grid grid-cols-2 gap-2 mt-3">`;
            photoUrls.forEach((url, i) => {
                let thumbUrl = url;
                if (url && url.includes('drive.google.com/file/d/')) {
                    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) thumbUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w300`;
                }
                // Make download URL
                let downloadUrl = url;
                if (url && url.includes('drive.google.com/file/d/')) {
                    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) downloadUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
                }
                photosHtml += `
                    <div class="relative group">
                        <img src="${thumbUrl}" class="w-full aspect-square object-cover rounded-lg border border-slate-200 bg-slate-100 cursor-pointer" 
                             onclick="openJurnalImageViewer('${thumbUrl.replace('sz=w300','sz=w1200')}', '${downloadUrl}', 'Foto ${i+1} - Minggu ${entry.weekStart}')" 
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQ3NTU2OSIgZD0iTTEyIDJDMiAyIDIgMTIgMiAxMnMyIDEwIDEwIDEwIDEwLTEwIDEwLTEwUzIyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6Ii8+PC9zdmc+'" 
                             alt="Foto ${i+1}">
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <i class="ph ph-magnifying-glass-plus text-white text-xl"></i>
                        </div>
                    </div>
                `;
            });
            photosHtml += `</div>`;
        }
        
        html += `
        <div class="jurnal-card ${isCurrentWeek ? 'ring-2 ring-primary/30' : ''}">
            <div class="p-4">
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            ${isCurrentWeek ? '<span class="text-[10px] bg-primary text-white px-2 py-0.5 rounded-md font-bold uppercase">Minggu Ini</span>' : ''}
                            <span class="text-[10px] ${progressColor.replace('bg-','text-').replace('500','600')} ${progressColor.replace('500','50')} border ${progressColor.replace('bg-','border-').replace('500','200')} px-2 py-0.5 rounded-md font-bold">${photoCount}/2 Foto</span>
                        </div>
                        <p class="text-sm font-bold text-slate-800">${entry.weekStart || ''} — ${entry.weekEnd || ''}</p>
                    </div>
                    <button onclick="deleteJurnal('${entry.id}')" class="text-slate-400 hover:text-rose-500 transition-colors p-1" title="Hapus Jurnal">
                        <i class="ph ph-trash text-lg"></i>
                    </button>
                </div>
                
                <div class="jurnal-status-bar mb-3">
                    <div class="jurnal-status-fill ${progressColor}" style="width: ${progressPct}%"></div>
                </div>
                
                ${entry.keterangan ? `<p class="text-sm text-slate-600 leading-relaxed mb-1"><span class="font-semibold text-slate-700">Kegiatan:</span> ${entry.keterangan}</p>` : ''}
                <p class="text-xs text-slate-400 mt-1"><i class="ph ph-clock"></i> Dikirim: ${entry.waktu || '-'}</p>
                
                ${photosHtml}
            </div>
        </div>`;
    });
    
    historyContainer.innerHTML = html;
}

// Image Viewer Modal for Jurnal
function openJurnalImageViewer(imgSrc, downloadUrl, title) {
    // Create modal overlay
    let modal = document.getElementById('jurnalImageModal');
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = 'jurnalImageModal';
    modal.className = 'fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4 animate-fadeIn';
    modal.innerHTML = `
        <div class="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <p class="text-white text-sm font-semibold truncate flex-1 mr-4">${title}</p>
            <div class="flex gap-2">
                <a href="${downloadUrl}" target="_blank" rel="noopener" class="bg-white/20 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-white/30 transition-all">
                    <i class="ph ph-download-simple text-lg"></i> Unduh
                </a>
                <button onclick="document.getElementById('jurnalImageModal').remove()" class="bg-white/20 backdrop-blur-sm text-white p-2 rounded-xl hover:bg-white/30 transition-all">
                    <i class="ph ph-x text-xl font-bold"></i>
                </button>
            </div>
        </div>
        <img src="${imgSrc}" class="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" alt="${title}">
    `;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
}
// Make functions globally accessible
window.handleJurnalFileSelect = handleJurnalFileSelect;
window.removeJurnalPhoto = removeJurnalPhoto;
window.submitJurnal = submitJurnal;
window.openJurnalImageViewer = openJurnalImageViewer;

window.submitAgendaHarian = async function() {
    const inputEl = document.getElementById('inputAgendaHarianBaru');
    if(!inputEl) return;
    const agendaText = inputEl.value.trim();
    if (!agendaText) return showToast("Mohon isi deskripsi kegiatan hari ini!", "error");
    
    const btn = document.getElementById('btnSubmitAgenda');
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> Menyimpan...`;
    
    try {
        const payload = { action: "submitAgendaHarian", nisn: userData.nisn, agenda: agendaText };
        const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        const result = await res.json();
        
        if (result.status === 'success') {
            showToast("Jurnal Harian berhasil disimpan! 🎉");
            fetchRekap(userData.nisn); // Reload all data
        } else {
            showToast(result.message, "error");
            btn.disabled = false;
            btn.innerHTML = `<i class="ph ph-check-circle text-lg font-bold"></i> Simpan Jurnal Harian`;
        }
    } catch (e) {
        showToast("Koneksi gagal. Coba lagi.", "error");
        btn.disabled = false;
        btn.innerHTML = `<i class="ph ph-check-circle text-lg font-bold"></i> Simpan Jurnal Harian`;
    }
}

window.deleteAbsenHariIni = async function() {
    if(!confirm("Apakah Anda yakin ingin membatalkan (menghapus) absen hari ini?")) return;
    
    loadingOverlay.classList.remove('hidden');
    try {
        const payload = { action: "deleteAbsen", nisn: userData.nisn };
        const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        const result = await res.json();
        
        if (result.status === 'success') {
            showToast("Absen hari ini berhasil dibatalkan!");
            fetchRekap(userData.nisn); // Reload data
        } else {
            showToast(result.message, "error");
        }
    } catch (e) {
        showToast("Gagal membatalkan absen. Periksa koneksi.", "error");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

window.deleteJurnal = async function(id) {
    if(!confirm("Apakah Anda yakin ingin menghapus jurnal ini? Anda dapat mengupload ulang setelah dihapus.")) return;
    
    loadingOverlay.classList.remove('hidden');
    try {
        const payload = { action: "deleteJurnal", id: id, nisn: userData.nisn };
        const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        const result = await res.json();
        
        if (result.status === 'success') {
            showToast("Jurnal berhasil dihapus!");
            // Reset state jurnal upload UI jika menghapus jurnal minggu ini
            document.getElementById('jurnalUploadSection').innerHTML = `
                <div class="flex items-center justify-between">
                    <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <i class="ph ph-camera-plus text-primary text-lg"></i> Upload Dokumentasi
                    </h3>
                    <span id="jurnalUploadCount" class="text-xs font-bold text-primary bg-blue-50 px-2 py-1 rounded-lg">0/2 foto</span>
                </div>
                
                <div class="grid grid-cols-1 gap-4" id="jurnalPhotoSlots">
                    <div id="slotContainer1">
                        <div class="jurnal-upload-box" id="jurnalSlot1" onclick="document.getElementById('jurnalFile1').click()">
                            <input type="file" id="jurnalFile1" accept="image/*" class="hidden" onchange="handleJurnalFileSelect(this, 1)">
                            <div id="jurnalSlot1Content">
                                <i class="ph ph-image-square text-3xl text-slate-400 mb-1"></i>
                                <p class="text-sm font-semibold text-slate-500">Foto 1</p>
                                <p class="text-xs text-slate-400">Tap untuk upload</p>
                            </div>
                        </div>
                        <textarea id="jurnalKeterangan1" placeholder="Keterangan foto 1..." class="w-full mt-2 bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:bg-white transition-all resize-none h-16"></textarea>
                    </div>
                    <div id="slotContainer2" class="hidden">
                        <div class="jurnal-upload-box" id="jurnalSlot2" onclick="document.getElementById('jurnalFile2').click()">
                            <input type="file" id="jurnalFile2" accept="image/*" class="hidden" onchange="handleJurnalFileSelect(this, 2)">
                            <div id="jurnalSlot2Content">
                                <i class="ph ph-image-square text-3xl text-slate-400 mb-1"></i>
                                <p class="text-sm font-semibold text-slate-500">Foto 2 (Rekomendasi)</p>
                                <p class="text-xs text-slate-400">Tap untuk upload</p>
                            </div>
                        </div>
                        <textarea id="jurnalKeterangan2" placeholder="Keterangan foto 2..." class="w-full mt-2 bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:bg-white transition-all resize-none h-16"></textarea>
                    </div>
                    <div id="slotContainer3" class="hidden">
                        <div class="jurnal-upload-box" id="jurnalSlot3" onclick="document.getElementById('jurnalFile3').click()">
                            <input type="file" id="jurnalFile3" accept="image/*" class="hidden" onchange="handleJurnalFileSelect(this, 3)">
                            <div id="jurnalSlot3Content">
                                <i class="ph ph-image-square text-3xl text-slate-400 mb-1"></i>
                                <p class="text-sm font-semibold text-slate-500">Foto 3 (Opsional)</p>
                                <p class="text-xs text-slate-400">Tap untuk upload</p>
                            </div>
                        </div>
                        <textarea id="jurnalKeterangan3" placeholder="Keterangan foto 3..." class="w-full mt-2 bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:bg-white transition-all resize-none h-16"></textarea>
                    </div>
                    
                    <button id="btnAddSlot" onclick="tambahSlotJurnal()" class="w-full border-2 border-dashed border-slate-200 text-slate-500 hover:text-primary hover:border-primary hover:bg-blue-50 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all">
                        <i class="ph ph-plus-circle text-lg"></i> Tambah Dokumentasi
                    </button>
                </div>

                <button id="btnSubmitJurnal" onclick="submitJurnal()" class="w-full bg-primary hover:bg-blue-900 active:scale-95 text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all shadow-sm mt-2">
                    <i class="ph ph-paper-plane-right text-lg font-bold"></i> Kirim Dokumentasi Mingguan
                </button>
            `;
            jurnalPhotos = [null, null, null];
            visibleJurnalSlots = 1;
            fetchJurnal(userData.nisn);
        } else {
            showToast(result.message, "error");
        }
    } catch (e) {
        showToast("Gagal menghapus jurnal. Periksa koneksi.", "error");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

btnSubmit.addEventListener('click', async () => {
    const selectedStatus = inputStatus.value;
    const alasan = inputAlasan.value.trim();

    if (selectedStatus === 'Hadir') {
        
        if (!userData.lat || !userData.lng) return showToast("Lokasi GPS belum didapatkan.", "error");
        
        // Cek pengumpulan sampel GPS
        if (gpsHistory.length < 3) {
            return showToast("Mengkalibrasi sinyal GPS, mohon tunggu beberapa detik...", "error");
        }

        // Fake GPS Protection: Silent treatment jika tidak ada fluktuasi sama sekali (statis)
        const first = gpsHistory[0];
        const isStatic = gpsHistory.every(p => p.lat === first.lat && p.lng === first.lng);
        if (isStatic) return; // Silent treatment: Do nothing

        if (userData.psgLat && userData.psgLng) {
            const d = getDistanceFromLatLonInM(userData.lat, userData.lng, userData.psgLat, userData.psgLng);
            if (d > 50) {
                return showToast(`Anda berada di luar radius PSG (Jarak: ${Math.round(d)}m). Maksimal 50m.`, "error");
            }
        }
    }

    if ((selectedStatus === 'Sakit' || selectedStatus === 'Izin') && !alasan) return showToast("Mohon tulis alasan Anda!", "error");

    loadingOverlay.classList.remove('hidden');
    
    try {
        const payload = { action: "absen", nisn: userData.nisn, lat: userData.lat, lng: userData.lng, status: selectedStatus, alasan: alasan, agenda: "", photoBase64: userData.photoBase64, gpsHistory: gpsHistory };
        const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' }});
        const result = await res.json();
        
        if (result.status === 'success') {
            showToast("Berhasil Absen!");
            fetchRekap(userData.nisn); // Update data
            
            // Reset state absen
            inputStatus.value = 'Hadir';
            inputAlasan.value = '';
            boxAlasan.classList.add('hidden');
            if (userData.photoBase64) btnRetake.click();

            document.querySelector('[data-target=dashboard]').click(); // Go back to home
        } else {
            showToast(result.message, "error");
        }
    } catch (e) {
        showToast("Terjadi kesalahan koneksi.", "error");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
});
