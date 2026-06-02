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
            daftarSiswaCache.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.nisn;
                opt.textContent = s.nama;
                selectDetailSiswa.appendChild(opt);
            });
            
            renderCurrentTab();
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

// Events
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

selectDetailSiswa.addEventListener('change', renderDetailSiswa);
detailMonthSelector.addEventListener('change', renderDetailSiswa);

document.getElementById('btnExportPdf').addEventListener('click', () => window.print());
