const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZYfk70rs-WOOHQeq4RR93VtdzcpvTIk4aMv2rKUgFqGJ6RiOReb2QNnMbNZUp5fkLwg/exec";

// DOM Elements
const sectionLogin = document.getElementById('loginSection');
const mainApp = document.getElementById('mainApp');
const inputIdGuru = document.getElementById('inputIdGuru');
const inputSecret = document.getElementById('inputSecret');
const btnLanjut = document.getElementById('btnLanjut');
const userProfile = document.getElementById('userProfile');
const displayNamaGuru = document.getElementById('displayNamaGuru');
const btnProfileMenu = document.getElementById('btnProfileMenu');
const dropdownMenu = document.getElementById('dropdownMenu');
const loadingOverlay = document.getElementById('loadingOverlay');

const searchHarian = document.getElementById('searchHarian');
const searchPeriodik = document.getElementById('searchPeriodik');
const filterPeriodik = document.getElementById('filterPeriodik');
const weekSelector = document.getElementById('weekSelector');
const monthSelector = document.getElementById('monthSelector');
const selectDetailSiswa = document.getElementById('selectDetailSiswa');
const detailMonthSelector = document.getElementById('detailMonthSelector');
const listDetailSiswa = document.getElementById('listDetailSiswa');

// Initialize selectors default values
const initNow = new Date();
const currentMonthStr = `${initNow.getFullYear()}-${(initNow.getMonth()+1).toString().padStart(2,'0')}`;
monthSelector.value = currentMonthStr;
detailMonthSelector.value = currentMonthStr;

function getWeekStr(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const week = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}
weekSelector.value = getWeekStr(initNow);

function getMondayFromWeek(weekStr) {
    if (!weekStr) return null;
    const [year, week] = weekStr.split('-W');
    const d = new Date(year, 0, 1);
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    d.setDate(d.getDate() + 7 * (week - 1) - 3);
    return d;
}

// State
let rawDataCache = [];
let daftarSiswaCache = [];
let pengaturanCache = { tglMulai: '', tglSelesai: '', libur: [] };
let jurnalGuruCache = [];
let currentTab = 'dashboard';

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

// Init
window.onload = () => {
    const savedNamaGuru = localStorage.getItem('nama_guru');
    if (savedNamaGuru) {
        setLoggedInState(savedNamaGuru);
    }
};

function setLoggedInState(nama) {
    displayNamaGuru.innerText = nama;
    userProfile.style.display = 'flex';
    sectionLogin.style.display = 'none';
    mainApp.style.display = 'flex';
    switchTab('dashboard');
    fetchData(nama);
}

// Login Process
btnLanjut.addEventListener('click', async () => {
    const idGuru = inputIdGuru.value.trim();
    const secret = inputSecret.value.trim();
    if (!idGuru || !secret) {
        showToast("Mohon masukkan ID dan Kata Sandi", "error");
        return;
    }

    const originalText = btnLanjut.innerHTML;
    btnLanjut.innerHTML = `<div class="spinner w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> Verifikasi...`;
    btnLanjut.disabled = true;

    try {
        const payload = { action: "login_guru", idGuru: idGuru, secret: secret };
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            localStorage.setItem('nama_guru', result.nama);
            setLoggedInState(result.nama);
            showToast("Login Berhasil!");
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

// Logout
document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('nama_guru');
    window.location.reload();
});

if (btnProfileMenu && dropdownMenu) {
    btnProfileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!btnProfileMenu.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });
}

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTab = e.currentTarget.getAttribute('data-target');
        switchTab(currentTab);
        renderCurrentTab();
    });
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('flex');
    });
    const target = document.getElementById('tab-' + tabId);
    if(target) {
        target.classList.remove('hidden');
        if(tabId !== 'dashboard') target.classList.add('flex');
    }
    // Show/hide PSG info based on tab
    const psgSection = document.getElementById('psgInfoSection');
    if (psgSection) {
        if (tabId === 'dashboard') psgSection.classList.remove('hidden');
        else psgSection.classList.add('hidden');
    }
}

// Fetch Data
async function fetchData(namaGuru) {
    loadingOverlay.classList.remove('hidden');
    try {
        const url = `${GOOGLE_SCRIPT_URL}?action=getRekapGuru&namaGuru=${encodeURIComponent(namaGuru)}&bulan=all`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (result.status === 'success') {
            rawDataCache = result.data || [];
            daftarSiswaCache = result.siswa || [];
            pengaturanCache = result.pengaturan || { tglMulai: '', tglSelesai: '', libur: [] };
            
            // Populate Detail Siswa Select
            selectDetailSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
            const selectJurnalSiswa = document.getElementById('selectJurnalSiswa');
            selectJurnalSiswa.innerHTML = '<option value="all">Semua Siswa</option>';
            daftarSiswaCache.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.nisn;
                opt.textContent = s.nama;
                selectDetailSiswa.appendChild(opt);
                
                const opt2 = document.createElement('option');
                opt2.value = s.nisn;
                opt2.textContent = s.nama;
                selectJurnalSiswa.appendChild(opt2);
            });
            
            renderCurrentTab();
            
            // Fetch jurnal data
            fetchJurnalGuru(namaGuru);
        } else {
            showToast(result.message, "error");
        }
    } catch (e) {
        showToast("Gagal memuat data rekap.", "error");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// Global Filter Logic (Gets padded data)
function getFilteredData(waktu, keyword) {
    const todayStr = getTodayStr();
    const now = new Date();
    
    let filtered = rawDataCache.filter(item => {
        if (waktu === 'all') return true;
        if (waktu === 'today') {
            const itemDate = parseDate(item.tanggal);
            return itemDate.getDate() === now.getDate() && itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
        if (waktu === 'week') {
            const itemDate = parseDate(item.tanggal);
            let monday = getMondayFromWeek(weekSelector.value);
            if (!monday) {
                let day = now.getDay();
                monday = new Date(now.setDate(now.getDate() - day + (day === 0 ? -6 : 1)));
            }
            monday.setHours(0,0,0,0);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            sunday.setHours(23,59,59,999);
            return itemDate >= monday && itemDate <= sunday;
        }
        if (waktu === 'month') {
            const itemDate = parseDate(item.tanggal);
            const monthVal = monthSelector.value;
            if (monthVal) {
                const [y, m] = monthVal.split('-');
                return itemDate.getFullYear() == y && (itemDate.getMonth() + 1) == m;
            }
            return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    // Pad missing students
    if (daftarSiswaCache.length > 0) {
        const sudahAbsenNisn = filtered.map(item => item.nisn);
        const belumAbsen = daftarSiswaCache.filter(s => !sudahAbsenNisn.includes(s.nisn));
        belumAbsen.forEach(s => {
            filtered.push({
                nisn: s.nisn, nama: s.nama,
                tanggal: waktu === 'today' ? todayStr : '--/--/----',
                waktu: '--:--', status: 'Belum Absen', foto: null, alasan: ''
            });
        });
    }

    if(keyword) {
        const kw = keyword.toLowerCase();
        filtered = filtered.filter(i => i.nama.toLowerCase().includes(kw) || i.nisn.toLowerCase().includes(kw));
    }

    filtered.sort((a, b) => {
        if (a.status === 'Belum Absen' && b.status !== 'Belum Absen') return -1;
        if (a.status !== 'Belum Absen' && b.status === 'Belum Absen') return 1;
        return a.nama.localeCompare(b.nama);
    });

    return filtered;
}

// Render Logic Switcher
function renderCurrentTab() {
    if (currentTab === 'dashboard') renderDashboard();
    else if (currentTab === 'harian') renderHarian();
    else if (currentTab === 'periodik') renderPeriodik();
    else if (currentTab === 'detail') renderDetailSiswa();
    else if (currentTab === 'jurnal') renderJurnalGuru();
}

function renderDashboard() {
    document.getElementById('dashTotalSiswa').innerText = `${daftarSiswaCache.length} Siswa`;
    
    let H = 0, S = 0, I = 0, A = 0;
    const todayData = getFilteredData('today', '');
    
    todayData.forEach(item => {
        if(item.status === 'Hadir') H++;
        else if(item.status === 'Sakit') S++;
        else if(item.status === 'Izin') I++;
        else if(item.status === 'Belum Absen') A++;
    });

    document.getElementById('dashHadir').innerText = H;
    document.getElementById('dashSakit').innerText = S;
    document.getElementById('dashIzin').innerText = I;
    document.getElementById('dashBelum').innerText = A;
    
    // Render PSG Info Section in Dashboard
    renderPsgInfoDashboard();
}

function renderHarian() {
    const keyword = searchHarian.value;
    const data = getFilteredData('today', keyword);
    const container = document.getElementById('listHarian');
    
    if (!data.length) {
        container.innerHTML = `<div class="text-center text-slate-400 text-sm py-10 font-medium">Tidak ada data.</div>`;
        return;
    }

    let html = '';
    data.forEach(item => {
        let badgeColor = item.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            item.status === 'Izin' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            item.status === 'Belum Absen' ? 'bg-slate-100 text-slate-500 border-slate-300' : 'bg-rose-50 text-rose-700 border-rose-200';

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
                    <span class="text-slate-800 font-semibold text-sm truncate">${item.nama}</span>
                    <span class="text-[10px] border px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${badgeColor}">${item.status}</span>
                </div>
                <div class="text-slate-500 text-xs font-medium truncate">${item.tanggal} • ${item.waktu} ${item.alasan ? '• ' + item.alasan : ''}</div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
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

function renderPeriodik() {
    const waktu = filterPeriodik.value;
    const keyword = searchPeriodik.value;
    const data = getFilteredData(waktu, keyword);
    const container = document.getElementById('tablePeriodik');

    if (!data.length && !pengaturanCache.tglMulai) {
        container.innerHTML = `<div class="text-center text-slate-400 text-sm py-10 font-medium">Tidak ada data rekap.</div>`;
        return;
    }

    let html = '';
    
    if (waktu === 'all') {
        // SUMMARY TABLE
        let stats = {};
        daftarSiswaCache.forEach(s => stats[s.nisn] = { nama: s.nama, H: 0, I: 0, S: 0, A: 0 });
        
        // Hitung total hari kerja yang valid sejak tglMulai s.d Hari Ini
        let workingDatesCount = 0;
        if (pengaturanCache.tglMulai) {
            let startD = parseDate(pengaturanCache.tglMulai);
            let endD = pengaturanCache.tglSelesai ? parseDate(pengaturanCache.tglSelesai) : new Date();
            let nowD = new Date();
            if (endD > nowD) endD = nowD;
            
            for(let curr = new Date(startD); curr <= endD; curr.setDate(curr.getDate()+1)) {
                let currStr = `${curr.getDate().toString().padStart(2,'0')}/${(curr.getMonth()+1).toString().padStart(2,'0')}/${curr.getFullYear()}`;
                if (isWorkingDay(currStr)) workingDatesCount++;
            }
        }

        data.forEach(item => {
            if (stats[item.nisn]) {
                if (item.status === 'Hadir') stats[item.nisn].H++;
                else if (item.status === 'Izin') stats[item.nisn].I++;
                else if (item.status === 'Sakit') stats[item.nisn].S++;
            }
        });

        // Set Alpha
        Object.values(stats).forEach(s => {
            if (pengaturanCache.tglMulai) {
                s.A = Math.max(0, workingDatesCount - (s.H + s.I + s.S));
            } else {
                s.A = data.filter(d => d.nisn === s.nisn && d.status === 'Belum Absen').length;
            }
        });

        // Terapkan search lagi karena object
        let statRows = Object.values(stats);
        if(keyword) {
            const kw = keyword.toLowerCase();
            statRows = statRows.filter(s => s.nama.toLowerCase().includes(kw));
        }

        html += `
        <div class="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm w-full">
            <table class="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                    <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                        <th class="p-3 font-semibold text-center w-10">No</th>
                        <th class="p-3 font-semibold">Nama Siswa</th>
                        <th class="p-3 font-semibold text-center text-emerald-600">Hadir</th>
                        <th class="p-3 font-semibold text-center text-rose-600">Sakit</th>
                        <th class="p-3 font-semibold text-center text-amber-600">Izin</th>
                        <th class="p-3 font-semibold text-center text-slate-500">Alpha</th>
                    </tr>
                </thead>
                <tbody class="text-sm divide-y divide-slate-100">`;
        
        statRows.forEach((row, index) => {
            html += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center text-slate-400 text-xs">${index + 1}</td>
                    <td class="p-3 font-semibold text-slate-800">${row.nama}</td>
                    <td class="p-3 text-center font-bold text-emerald-600 bg-emerald-50/50">${row.H}</td>
                    <td class="p-3 text-center font-bold text-rose-600 bg-rose-50/50">${row.S}</td>
                    <td class="p-3 text-center font-bold text-amber-600 bg-amber-50/50">${row.I}</td>
                    <td class="p-3 text-center font-bold text-slate-500">${row.A}</td>
                </tr>`;
        });
        html += `</tbody></table></div>`;
    } else {
        // MATRIX TABLE (WEEK / MONTH)
        let dates = [];
        const now = new Date();
        
        if (waktu === 'week') {
            let monday = getMondayFromWeek(weekSelector.value);
            if(!monday) monday = new Date();
            for(let i=0; i<7; i++) {
                let d = new Date(monday);
                d.setDate(d.getDate() + i);
                dates.push(`${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`);
            }
        } else if (waktu === 'month') {
            const monthVal = monthSelector.value || currentMonthStr;
            const [yearStr, monthStr] = monthVal.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr) - 1;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for(let i=1; i<=daysInMonth; i++) {
                dates.push(`${i.toString().padStart(2,'0')}/${(month+1).toString().padStart(2,'0')}/${year}`);
            }
        }

        let matrix = {};
        daftarSiswaCache.forEach(s => {
            matrix[s.nisn] = { nama: s.nama, records: {} };
            dates.forEach(d => matrix[s.nisn].records[d] = '-');
        });

        data.forEach(item => {
            if (matrix[item.nisn] && matrix[item.nisn].records[item.tanggal] !== undefined) {
                let stat = item.status === 'Hadir' ? 'H' : item.status === 'Izin' ? 'I' : item.status === 'Sakit' ? 'S' : '-';
                matrix[item.nisn].records[item.tanggal] = stat;
            }
        });

        // Terapkan "A" pada hari kerja yang belum absen
        dates.forEach(d => {
            if (isWorkingDay(d)) {
                Object.values(matrix).forEach(m => {
                    if (m.records[d] === '-') m.records[d] = 'A';
                });
            }
        });

        let matrixRows = Object.values(matrix);
        if(keyword) {
            const kw = keyword.toLowerCase();
            matrixRows = matrixRows.filter(s => s.nama.toLowerCase().includes(kw));
        }

        html += `
        <div class="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm w-full relative">
            <table class="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                    <tr class="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                        <th class="p-2 font-semibold text-center sticky left-0 bg-slate-50 z-10 border-r border-slate-200 min-w-[30px]">No</th>
                        <th class="p-2 font-semibold sticky left-[30px] bg-slate-50 z-10 border-r border-slate-200 min-w-[120px]">Siswa</th>`;
        
        dates.forEach((d, i) => {
            let dayLabel = waktu === 'week' ? `Hari ${i+1}` : d.split('/')[0];
            html += `<th class="p-1 font-semibold text-center min-w-[30px]" title="${d}">${dayLabel}</th>`;
        });
        
        html += `
            <th class="p-2 font-semibold text-center text-emerald-600 bg-slate-100 border-l border-slate-200">H</th>
            <th class="p-2 font-semibold text-center text-rose-600 bg-slate-100">S</th>
            <th class="p-2 font-semibold text-center text-amber-600 bg-slate-100">I</th>
            <th class="p-2 font-semibold text-center text-slate-500 bg-slate-100 border-r border-slate-200">A</th>
        </tr></thead><tbody class="text-xs divide-y divide-slate-100">`;

        matrixRows.forEach((row, index) => {
            html += `<tr class="hover:bg-slate-50 transition-colors">
                <td class="p-2 text-center text-slate-400 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">${index + 1}</td>
                <td class="p-2 font-semibold text-slate-800 sticky left-[30px] bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)] truncate max-w-[120px]" title="${row.nama}">${row.nama}</td>`;
            
            let totalH = 0, totalS = 0, totalI = 0, totalA = 0;
            dates.forEach(d => {
                let stat = row.records[d];
                if (stat === 'H') totalH++; else if (stat === 'S') totalS++; else if (stat === 'I') totalI++; else if (stat === 'A') totalA++;
                let colorClass = stat === 'H' ? 'text-emerald-600 bg-emerald-50' : stat === 'I' ? 'text-amber-600 bg-amber-50' : stat === 'S' ? 'text-rose-600 bg-rose-50' : stat === 'A' ? 'text-slate-500 bg-slate-100' : 'text-slate-300';
                html += `<td class="p-1 text-center font-bold border-l border-slate-100 ${colorClass}" title="${d}: ${stat}">${stat}</td>`;
            });
            
            html += `
                <td class="p-1 text-center font-bold text-emerald-600 bg-emerald-50/50 border-l border-slate-200">${totalH}</td>
                <td class="p-1 text-center font-bold text-rose-600 bg-rose-50/50">${totalS}</td>
                <td class="p-1 text-center font-bold text-amber-600 bg-amber-50/50">${totalI}</td>
                <td class="p-1 text-center font-bold text-slate-500 bg-slate-50/50 border-r border-slate-200">${totalA}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }
    container.innerHTML = html;
}

function renderDetailSiswa() {
    const nisn = selectDetailSiswa.value;
    const monthVal = detailMonthSelector.value || currentMonthStr;
    const [y, m] = monthVal.split('-');
    
    if (!nisn) {
        listDetailSiswa.innerHTML = `<div class="text-center text-slate-400 text-sm py-10 font-medium">Pilih siswa terlebih dahulu.</div>`;
        return;
    }

    const studentData = rawDataCache.filter(item => {
        if (item.nisn !== nisn) return false;
        const itemDate = parseDate(item.tanggal);
        return itemDate.getFullYear() == y && (itemDate.getMonth() + 1) == m;
    });
    
    // Sort by date ascending (oldest to newest)
    studentData.sort((a,b) => parseDate(a.tanggal) - parseDate(b.tanggal));

    if (!studentData.length) {
        listDetailSiswa.innerHTML = `<div class="text-center text-slate-400 text-sm py-10 font-medium">Tidak ada data kehadiran di bulan ini.</div>`;
        return;
    }

    let html = '';
    studentData.forEach(item => {
        let badgeColor = item.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            item.status === 'Izin' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-rose-50 text-rose-700 border-rose-200';

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
                    <span class="text-slate-800 font-semibold text-sm truncate">${item.tanggal} • ${item.waktu}</span>
                    <span class="text-[10px] border px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${badgeColor}">${item.status}</span>
                </div>
                <div class="text-slate-500 text-xs font-medium">${item.alasan ? 'Alasan: ' + item.alasan : 'Lokasi: ' + (item.lat ? item.lat+','+item.lng : '-')}</div>
            </div>
        </div>`;
    });
    listDetailSiswa.innerHTML = html;
}

// ===== PSG INFO RENDERING =====
function renderPsgInfoDashboard() {
    const section = document.getElementById('psgInfoSection');
    const container = document.getElementById('psgInfoContainer');
    
    if (!daftarSiswaCache.length) {
        section.classList.add('hidden');
        return;
    }
    
    // Group students by PSG location
    const psgGroups = {};
    daftarSiswaCache.forEach(s => {
        const lokasi = s.lokasiPKL || 'Belum Ditentukan';
        if (!psgGroups[lokasi]) psgGroups[lokasi] = { detail: s.psgDetail, students: [] };
        psgGroups[lokasi].students.push(s);
    });
    
    let html = `<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
        <i class="ph ph-map-pin text-primary text-lg"></i> Info Lokasi PSG
    </h3>`;
    
    Object.entries(psgGroups).forEach(([lokasi, group]) => {
        const detail = group.detail;
        const studentNames = group.students.map(s => `<span class="inline-block bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100 mr-1 mb-1">${s.nama}</span>`).join('');
        
        html += `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-3">
            <div class="flex items-start gap-3 mb-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <i class="ph-fill ph-buildings text-xl"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-bold text-slate-800">${lokasi}</h4>
                    ${detail && detail.alamat ? `<p class="text-xs text-slate-500 mt-0.5"><i class="ph ph-map-pin"></i> ${detail.alamat}</p>` : ''}
                </div>
            </div>
            ${detail ? `
            <div class="grid grid-cols-1 gap-2 mb-3">
                ${detail.pemilik ? `
                <div class="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <i class="ph ph-crown text-amber-500"></i>
                    <div><p class="text-[10px] text-slate-400 font-semibold uppercase">Pemilik</p><p class="text-xs font-bold text-slate-700">${detail.pemilik}</p></div>
                </div>` : ''}
                ${detail.contactPerson ? `
                <div class="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <i class="ph ph-user-circle text-blue-500"></i>
                    <div class="flex-1"><p class="text-[10px] text-slate-400 font-semibold uppercase">Contact Person</p><p class="text-xs font-bold text-slate-700">${detail.contactPerson}</p></div>
                    ${detail.noTelpCP ? `<a href="tel:${detail.noTelpCP}" class="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-all"><i class="ph ph-phone text-sm"></i></a>` : ''}
                </div>` : ''}
                ${detail.noTelpCP ? `
                <div class="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <i class="ph ph-phone text-emerald-500"></i>
                    <div><p class="text-[10px] text-slate-400 font-semibold uppercase">No. Telepon</p><p class="text-xs font-bold text-slate-700">${detail.noTelpCP}</p></div>
                </div>` : ''}
            </div>` : ''}
            <div class="border-t border-slate-100 pt-2">
                <p class="text-[10px] text-slate-400 font-semibold uppercase mb-1">Siswa (${group.students.length})</p>
                <div class="flex flex-wrap">${studentNames}</div>
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
    // Visibility is controlled by switchTab()
    if (currentTab === 'dashboard') {
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
    }
}

function renderDetailPsgInfo(nisn) {
    const detailPsgInfo = document.getElementById('detailPsgInfo');
    if (!detailPsgInfo) return;
    
    const student = daftarSiswaCache.find(s => s.nisn === nisn);
    if (!student || !student.psgDetail) {
        detailPsgInfo.classList.add('hidden');
        detailPsgInfo.innerHTML = '';
        return;
    }
    
    const d = student.psgDetail;
    detailPsgInfo.classList.remove('hidden');
    detailPsgInfo.innerHTML = `
    <div class="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-4 space-y-3">
        <div class="flex items-center gap-2">
            <i class="ph-fill ph-buildings text-indigo-600 text-lg"></i>
            <h4 class="text-sm font-bold text-slate-800">${student.lokasiPKL || '-'}</h4>
        </div>
        <div class="grid grid-cols-1 gap-2 text-xs">
            <div class="flex items-start gap-2">
                <i class="ph ph-student text-slate-400 mt-0.5"></i>
                <div><span class="text-slate-400 font-semibold">Siswa:</span> <span class="text-slate-700 font-bold">${student.nama}</span> • <span class="text-slate-500">${student.kelas || '-'}</span> • <span class="text-slate-500">NISN: ${student.nisn}</span></div>
            </div>
            ${student.kontak ? `<div class="flex items-center gap-2"><i class="ph ph-phone text-slate-400"></i><span class="text-slate-400 font-semibold">Kontak Siswa:</span> <span class="text-slate-700 font-bold">${student.kontak}</span></div>` : ''}
            ${d.alamat ? `<div class="flex items-start gap-2"><i class="ph ph-map-pin text-slate-400 mt-0.5"></i><span class="text-slate-400 font-semibold">Alamat:</span> <span class="text-slate-700">${d.alamat}</span></div>` : ''}
            ${d.pemilik ? `<div class="flex items-center gap-2"><i class="ph ph-crown text-amber-500"></i><span class="text-slate-400 font-semibold">Pemilik:</span> <span class="text-slate-700 font-bold">${d.pemilik}</span></div>` : ''}
            ${d.contactPerson ? `<div class="flex items-center gap-2"><i class="ph ph-user-circle text-blue-500"></i><span class="text-slate-400 font-semibold">CP:</span> <span class="text-slate-700 font-bold">${d.contactPerson}</span> ${d.noTelpCP ? `(<a href="tel:${d.noTelpCP}" class="text-blue-600 underline">${d.noTelpCP}</a>)` : ''}</div>` : ''}
        </div>
    </div>`;
}

// ===== JURNAL GURU LOGIC =====
async function fetchJurnalGuru(namaGuru) {
    try {
        const url = `${GOOGLE_SCRIPT_URL}?action=getJurnalGuru&namaGuru=${encodeURIComponent(namaGuru)}`;
        const res = await fetch(url);
        const result = await res.json();
        if (result.status === 'success') {
            jurnalGuruCache = result.data || [];
            if (currentTab === 'jurnal') renderJurnalGuru();
        }
    } catch (e) {
        console.error("Gagal load jurnal guru", e);
    }
}

function renderJurnalGuru() {
    const container = document.getElementById('jurnalGuruContainer');
    const filterNisn = document.getElementById('selectJurnalSiswa').value;
    
    let data = jurnalGuruCache;
    if (filterNisn !== 'all') {
        data = data.filter(j => j.nisn === filterNisn);
    }
    
    if (!data.length) {
        container.innerHTML = `<div class="text-center text-slate-400 text-sm py-10 font-medium bg-white rounded-xl border border-slate-200">Belum ada data jurnal.</div>`;
        return;
    }
    
    // Sort by weekId descending
    const sorted = [...data].sort((a, b) => b.weekId.localeCompare(a.weekId));
    
    let html = '';
    sorted.forEach(entry => {
        const photoCount = entry.photoCount || 0;
        const progressPct = Math.round((photoCount / 3) * 100);
        const progressColor = photoCount >= 3 ? 'bg-emerald-500' : photoCount >= 2 ? 'bg-amber-500' : 'bg-rose-500';
        
        // Photo gallery
        let photosHtml = '';
        const photoUrls = entry.photoUrls || [];
        if (photoUrls.length > 0) {
            photosHtml = `<div class="grid grid-cols-3 gap-2 mt-3">`;
            photoUrls.forEach((url, i) => {
                let thumbUrl = url;
                if (url && url.includes('drive.google.com/file/d/')) {
                    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) thumbUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w300`;
                }
                let downloadUrl = url;
                if (url && url.includes('drive.google.com/file/d/')) {
                    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) downloadUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
                }
                photosHtml += `
                    <div class="relative group cursor-pointer" onclick="openGuruImageViewer('${thumbUrl.replace('sz=w300','sz=w1200')}', '${downloadUrl}', 'Foto ${i+1} - ${entry.nama} - Minggu ${entry.weekStart}')">
                        <img src="${thumbUrl}" class="w-full aspect-square object-cover rounded-lg border border-slate-200 bg-slate-100" 
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQ3NTU2OSIgZD0iTTEyIDJDMiAyIDIgMTIgMiAxMnMyIDEwIDEwIDEwIDEwLTEwIDEwLTEwUzIyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6Ii8+PC9zdmc+'" 
                             alt="Foto ${i+1}">
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <i class="ph ph-magnifying-glass-plus text-white text-xl"></i>
                        </div>
                    </div>`;
            });
            photosHtml += `</div>`;
        }
        
        html += `
        <div class="jurnal-card">
            <div class="p-4">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                            <span class="text-xs font-bold text-primary bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 truncate">${entry.nama}</span>
                            <span class="text-[10px] ${progressColor.replace('bg-','text-').replace('500','600')} ${progressColor.replace('500','50')} border ${progressColor.replace('bg-','border-').replace('500','200')} px-2 py-0.5 rounded-md font-bold">${photoCount}/3 Foto</span>
                        </div>
                        <p class="text-sm font-bold text-slate-800">${entry.weekStart || ''} — ${entry.weekEnd || ''}</p>
                    </div>
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
    
    container.innerHTML = html;
}

// Image Viewer for Guru
function openGuruImageViewer(imgSrc, downloadUrl, title) {
    let modal = document.getElementById('guruImageModal');
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = 'guruImageModal';
    modal.className = 'fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.2s ease-out forwards';
    modal.innerHTML = `
        <div class="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <p class="text-white text-sm font-semibold truncate flex-1 mr-4">${title}</p>
            <div class="flex gap-2">
                <a href="${downloadUrl}" target="_blank" rel="noopener" class="bg-white/20 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-white/30 transition-all">
                    <i class="ph ph-download-simple text-lg"></i> Unduh
                </a>
                <button onclick="document.getElementById('guruImageModal').remove()" class="bg-white/20 backdrop-blur-sm text-white p-2 rounded-xl hover:bg-white/30 transition-all">
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

searchHarian.addEventListener('input', renderHarian);
searchPeriodik.addEventListener('input', renderPeriodik);
filterPeriodik.addEventListener('change', (e) => {
    const val = e.target.value;
    weekSelector.classList.toggle('hidden', val !== 'week');
    monthSelector.classList.toggle('hidden', val !== 'month');
    renderPeriodik();
});
weekSelector.addEventListener('change', renderPeriodik);
monthSelector.addEventListener('change', renderPeriodik);

selectDetailSiswa.addEventListener('change', () => {
    renderDetailSiswa();
    renderDetailPsgInfo(selectDetailSiswa.value);
});
detailMonthSelector.addEventListener('change', renderDetailSiswa);

document.getElementById('selectJurnalSiswa').addEventListener('change', renderJurnalGuru);

document.getElementById('btnExportPdf').addEventListener('click', () => window.print());
