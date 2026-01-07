// script.js
// Core Logic, State Management, and UI Rendering

// --- STATE ---
const DEFAULT_SETTINGS = {
    apiKey: "",
    workTime: "09:00",
    homeTime: "18:00",
    workTrans: ["train", "mrt", "bus", "bike"],
    homeTrans: ["train", "mrt", "bus", "bike"],
    workLastMile: { name: "", trans: [], coords: null },
    homeLastMile: { name: "", trans: [], coords: null },
    holiday: {
        oldHomeLastMile: { name: "", trans: [], coords: null },
        homeLastMile: { name: "", trans: [], coords: null },
        oldHomeTrans: ["train", "mrt", "bus", "bike"],
        homeTrans: ["train", "mrt", "bus", "bike"]
    }
};

const state = {
    train: [], // Loaded in init
    mrt: [],
    bus: [],
    bike: [],
    settings: DEFAULT_SETTINGS
};

// --- HELPER: TIME LOGIC ---
function getCommuteMode(mockDate = null) {
    const now = mockDate || new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMinutes = hour * 60 + minute;

    // 1. Late Night Check (00:00 - 05:00)
    if (hour >= 0 && hour < 5) {
        return 'late_night';
    }

    // 2. Work Check (Work Time +/- 3 hours)
    if (state.settings.workTime) {
        const [wHour, wMinute] = state.settings.workTime.split(':').map(Number);
        const workMinutes = wHour * 60 + wMinute;
        const diff = Math.abs(currentMinutes - workMinutes);

        // +/- 3 hours = 180 minutes
        if (diff <= 180) {
            return 'work';
        }
    }

    // 3. Default: Home (After work)
    return 'home';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App Initializing...");
    try {
        loadState();
        console.log("✅ State Loaded:", state);

        // Legacy Migration (for API Key from old localStorage key)
        if (typeof oldKey !== 'undefined' && oldKey && !state.settings.apiKey) {
            state.settings.apiKey = oldKey;
            saveState(); // Consolidate
            localStorage.removeItem('user_gemini_key'); // Clean up
        }

        // Init Holiday if missing (for legacy data)
        if (!state.settings.holiday) {
            state.settings.holiday = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.holiday));
        }

        // Render
        renderAllStations();
        updatePromptPreview();
        checkKeyStatus();

        // Auto-open settings if incomplete
        checkSettingsAndPrompt();

        // Version
        if (typeof BUILD_INFO !== 'undefined') {
            document.getElementById('versionInfo').innerText = `v${BUILD_INFO.time}`;
        }
    } catch (e) {
        console.error("❌ Init Error:", e);
    }
});

// --- STATE MANAGEMENT ---
function loadState() {
    // Stations
    state.train = JSON.parse(localStorage.getItem('user_stations_train')) || [];
    state.mrt = JSON.parse(localStorage.getItem('user_stations_mrt')) || [];
    state.bus = JSON.parse(localStorage.getItem('user_stations_bus')) || [];
    state.bike = JSON.parse(localStorage.getItem('user_stations_bike')) || [];

    // Legacy Data Migration (String -> Object)
    ['train', 'mrt', 'bus', 'bike'].forEach(type => {
        if (state[type] && state[type].length > 0 && typeof state[type][0] === 'string') {
            state[type] = state[type].map(s => ({ name: s, lat: null, lng: null }));
        }
    });

    // Settings
    const savedSettings = JSON.parse(localStorage.getItem('user_settings'));
    if (savedSettings) {
        state.settings = { ...DEFAULT_SETTINGS, ...savedSettings };

        // Migrate old 'lastMile' (generic) to 'homeLastMile' if needed
        if (savedSettings.lastMile) {
            if (!state.settings.homeLastMile.name) {
                state.settings.homeLastMile = savedSettings.lastMile;
            }
            delete state.settings.lastMile; // Cleanup
        }

        // Ensure structure
        if (!state.settings.workLastMile) state.settings.workLastMile = DEFAULT_SETTINGS.workLastMile;
        if (!state.settings.homeLastMile) state.settings.homeLastMile = DEFAULT_SETTINGS.homeLastMile;
    }
}

function saveState() {
    localStorage.setItem('user_stations_train', JSON.stringify(state.train));
    localStorage.setItem('user_stations_mrt', JSON.stringify(state.mrt));
    localStorage.setItem('user_stations_bus', JSON.stringify(state.bus));
    localStorage.setItem('user_stations_bike', JSON.stringify(state.bike));
    localStorage.setItem('user_settings', JSON.stringify(state.settings));
    updatePromptPreview();
    checkKeyStatus();
}

// --- SETTINGS UI ---
function switchSettingsTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
        el.style.color = '#888';
        el.style.borderBottom = 'none';
    });

    document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).style.display = 'block';
    const btn = document.getElementById(`tabBtn${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    btn.classList.add('active');
    btn.style.color = 'var(--text-color)';
    btn.style.borderBottom = '2px solid var(--accent-color)';
}

function openSettings() {
    // Load current settings into form
    document.getElementById('settingApiKey').value = state.settings.apiKey;

    // Weekday
    document.getElementById('settingWorkTime').value = state.settings.workTime;
    document.getElementById('settingHomeTime').value = state.settings.homeTime;
    document.getElementById('settingWorkStation').value = state.settings.workLastMile.name || "";
    document.getElementById('settingHomeStation').value = state.settings.homeLastMile.name || "";

    // Holiday
    if (state.settings.holiday) {
        document.getElementById('settingOldHomeStation').value = state.settings.holiday.oldHomeLastMile.name || "";
        document.getElementById('settingHolidayHomeStation').value = state.settings.holiday.homeLastMile.name || "";
    }

    // Apply Checkboxes Logic (Transport-in-transit only)
    const setCheckboxes = (name, values) => {
        document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
            cb.checked = (values || []).includes(cb.value);
        });
    };

    // Weekday Checkboxes
    setCheckboxes('workTrans', state.settings.workTrans);
    setCheckboxes('homeTrans', state.settings.homeTrans);

    // Holiday Checkboxes
    if (state.settings.holiday) {
        // renderStatus removed
    }

    document.getElementById('settingsModal').classList.add('active');
    if (window.innerWidth <= 768) toggleSidebar();
}

function saveSettings() {
    // Helper to infer type from name string "Station (Type)"
    const inferType = (str) => {
        if (!str) return [];
        if (str.includes('(火車)')) return ['train'];
        if (str.includes('(捷運)')) return ['mrt'];
        if (str.includes('(公車)')) return ['bus'];
        if (str.includes('(YouBike)')) return ['bike'];
        return ['train', 'mrt', 'bus', 'bike']; // Default fallback
    };

    // API Key
    state.settings.apiKey = document.getElementById('settingApiKey').value;

    // Weekday
    state.settings.workTime = document.getElementById('settingWorkTime').value;
    state.settings.homeTime = document.getElementById('settingHomeTime').value;
    state.settings.workTrans = Array.from(document.querySelectorAll('input[name="workTrans"]:checked')).map(cb => cb.value);
    state.settings.homeTrans = Array.from(document.querySelectorAll('input[name="homeTrans"]:checked')).map(cb => cb.value);

    // Weekday Last Mile
    const workVal = document.getElementById('settingWorkStation').value;
    state.settings.workLastMile.name = workVal;
    state.settings.workLastMile.trans = inferType(workVal);

    const homeVal = document.getElementById('settingHomeStation').value;
    state.settings.homeLastMile.name = homeVal;
    state.settings.homeLastMile.trans = inferType(homeVal);

    // Holiday
    if (!state.settings.holiday) state.settings.holiday = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.holiday));

    const oldHomeVal = document.getElementById('settingOldHomeStation').value;
    state.settings.holiday.oldHomeLastMile.name = oldHomeVal;

    // Default en-route logic for holiday (since UI removed)
    state.settings.holiday.oldHomeTrans = ['train', 'mrt', 'bus', 'bike'];
    state.settings.holiday.oldHomeLastMile.trans = inferType(oldHomeVal);

    const holHomeVal = document.getElementById('settingHolidayHomeStation').value;
    state.settings.holiday.homeLastMile.name = holHomeVal;
    state.settings.holiday.homeTrans = ['train', 'mrt', 'bus', 'bike'];
    state.settings.holiday.homeLastMile.trans = inferType(holHomeVal);

    saveState();
    checkKeyStatus();
    closeModal('settingsModal');
    updatePromptPreview();
    alert("設定已儲存！");
}




// --- MODAL & SIDEBAR ---
function openHelpModal() {
    document.getElementById('helpModal').classList.add('active');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// --- GPS ---
function getGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve("無GPS");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
            (err) => resolve("GPS失敗")
        );
    });
}

// --- STATION MODAL ---
let currentModalType = '';
let currentCategory = '';
let selectionMode = 'manage'; // 'manage' or 'select' (for last mile)
let selectionTarget = ''; // 'work', 'home', ...

function openStationModal(type, mode) {
    currentModalType = type;
    if (mode === 'select') {
        // Keep selectionMode = 'select' and selectionTarget from openSourceSelectModal
        document.getElementById('modalTitle').innerText = `選擇 ${type === 'bike' ? 'YouBike' : type === 'mrt' ? '捷運' : type === 'bus' ? '公車' : '火車'} 站點`;
        document.getElementById('stationModal').classList.add('modal-overlay-top');
        document.getElementById('stationModal').classList.remove('modal-overlay');
        // Hide sourceSelectModal when opening station modal
        document.getElementById('sourceSelectModal').classList.remove('active');
    } else {
        selectionMode = 'manage';
        selectionTarget = '';
        document.getElementById('modalTitle').innerText = `管理 ${type === 'bike' ? 'YouBike' : type === 'mrt' ? '捷運' : type === 'bus' ? '公車' : '火車'} 站點`;
        // Reset class to default
        document.getElementById('stationModal').classList.remove('modal-overlay-top');
        document.getElementById('stationModal').classList.add('modal-overlay');
    }

    document.getElementById('modalSearch').value = '';

    renderSidebar(type);
    selectCategory('ADDED'); // Default view
    document.getElementById('stationModal').classList.add('active');

    if (type === 'bike') {
        helpText.innerText = "💡 提示: YouBike 站點眾多，建議使用上方搜尋功能";
    } else if (type === 'bus') {
        helpText.innerText = "💡 提示: 請選擇縣市與區域，並輸入關鍵字搜尋";
        renderBusSearchUI();
        return;
    } else {
        helpText.innerText = "";
    }
}

function openSourceSelectModal(target) {
    selectionMode = 'select';
    selectionTarget = target;
    document.getElementById('sourceSelectModal').classList.add('active');
}

function renderSidebar(type) {
    const sb = document.getElementById('modalSidebar');
    // Hide Search Input for Bus initially? Or keep it?
    // Bus uses its own input in sidebar or reuses the main one?
    // Let's hide the top search bar for Bus to avoid confusion, 
    // OR reuse it as the "Keyword" input. 
    // Plan: Reuse top search bar as "Keyword".

    // Reset Sidebar
    sb.innerHTML = '';

    // Add "Added" category
    const addedDiv = document.createElement('div');
    addedDiv.className = 'category-item active';
    addedDiv.innerText = "已新增列表";
    addedDiv.onclick = () => selectCategory('ADDED');
    sb.appendChild(addedDiv);

    // If bike, no default categories except "Search" (handled by UI)
    if (type === 'bike') return;

    // Load from STATION_DATA
    if (STATION_DATA[type]) {
        Object.keys(STATION_DATA[type]).forEach(cat => {
            const div = document.createElement('div');
            div.className = 'category-item';
            div.innerText = cat;
            div.onclick = () => selectCategory(cat);
            sb.appendChild(div);
        });
    }
}

function selectCategory(cat) {
    currentCategory = cat;
    // Active style
    document.querySelectorAll('#modalSidebar .category-item').forEach(el => {
        el.classList.toggle('active', el.innerText === (cat === 'ADDED' ? '已新增列表' : cat));
    });

    if (cat === 'ADDED') {
        renderGrid(state[currentModalType]);
        return;
    }

    const data = STATION_DATA[currentModalType][cat] || [];

    // Check if nested (City -> Line -> Stations) or flat (City -> Stations)
    if (Array.isArray(data)) {
        renderGrid(data);
    } else if (typeof data === 'object') {
        renderSubCategoryGrid(data);
    }
}

function renderSubCategoryGrid(subData) {
    const grid = document.getElementById('modalGrid');
    grid.innerHTML = '';

    Object.keys(subData).forEach(lineName => {
        const div = document.createElement('div');
        div.className = 'grid-item';
        div.style.background = 'rgba(56, 189, 248, 0.15)';
        div.style.borderColor = 'var(--accent-color)';
        div.innerText = lineName;
        div.innerHTML += '<span style="display:block;font-size:0.8em;color:#aaf">📂 點擊查看站點</span>';

        div.onclick = () => renderGrid(subData[lineName]);
        grid.appendChild(div);
    });
}

// --- HELPER: MAP LINK ---
function getMapLinkHtml(name, lat, lng) {
    const url = (lat && lng)
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
    return `<a href="${url}" target="_blank" style="text-decoration:none; margin-left:5px;" onclick="event.stopPropagation()">🗺️</a>`;
}

function renderGrid(items) {
    const grid = document.getElementById('modalGrid');
    grid.innerHTML = '';

    if (!items || items.length === 0) {
        grid.innerHTML = '<span style="color:#666; grid-column:1/-1; text-align:center;">無資料</span>';
        return;
    }

    items.forEach(item => {
        const name = item.name || item;
        const div = document.createElement('div');
        div.className = 'grid-item';

        // Name + Map Link
        div.innerHTML = `
            <span>${name}</span>
            ${getMapLinkHtml(name, item.lat, item.lng)}
        `;

        if (item.lat || (typeof item === 'object' && item.lat)) {
            div.innerHTML += '<span style="display:block;font-size:0.7em;color:gray">📍</span>';
        }

        // Selected state (Only show in 'manage' mode)
        if (selectionMode === 'manage' && state[currentModalType].some(s => (s.name || s) === name)) {
            div.classList.add('selected');
        }

        div.onclick = () => toggleStation(item);
        grid.appendChild(div);
    });
}

function toggleStation(item) {
    // Check Selection Mode
    if (selectionMode === 'select') {
        selectLastMileStation(item, currentModalType);
        return;
    }

    const list = state[currentModalType];
    const name = item.name || item;
    const idx = list.findIndex(s => (s.name || s) === name);

    if (idx >= 0) {
        list.splice(idx, 1);
    } else {
        // Ensure object structure
        list.push(typeof item === 'object' ? item : { name: item, lat: null, lng: null });
    }

    saveState();
    renderAllStations();

    if (document.getElementById('modalSearch').value) {
        // Re-filter if searching, but function not in local scope? 
        // We need 'filterStations'.
        filterStations(document.getElementById('modalSearch').value);
    } else {
        // Re-render grid to update selection style
        // We don't know exact context, just re-click category?
        // Simpler: Just rely on live update if easy.
        // Actually, 'selectCategory' re-renders.
        if (currentCategory === 'ADDED') {
            renderGrid(state[currentModalType]);
        } else {
            // Reload current view?
            // Accessing nested data is hard. 
            // Let's just assume user sees change on dashboard.
        }
    }
}

function selectLastMileStation(item, type) {
    const name = item.name || item;
    const typeLabel = { train: '火車', mrt: '捷運', bus: '公車', bike: 'YouBike' }[type] || type;
    const formattedName = `${name} (${typeLabel})`;

    let inputId;
    if (selectionTarget === 'work') inputId = 'settingWorkStation';
    else if (selectionTarget === 'home') inputId = 'settingHomeStation';
    else if (selectionTarget === 'holiday_oldHome') inputId = 'settingOldHomeStation';
    else if (selectionTarget === 'holiday_home') inputId = 'settingHolidayHomeStation';


    if (inputId) {
        document.getElementById(inputId).value = formattedName;
    }
    closeModal('stationModal');
    // openSettings(); // Do not reload settings, as it overwrites current inputs with saved state
}

function filterStations(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        selectCategory('ADDED');
        return;
    }

    // AI Check
    if (currentModalType === 'bike') {
        askGeminiForStations(q, 'bike');
        return;
    }

    const grid = document.getElementById('modalGrid');
    grid.innerHTML = '';

    // Flat search in STATION_DATA
    // Need to traverse...
    // Simplified: Search in Added first + some presets?
    // The original code had hybrid search.
    // Let's implement basic local search.

    // We don't have easy flat list for nested MRT/Train everywhere.
    // Skip complex search implementation for now or create a flat list on init?
    // Let's just search 'Added'.

    // For now, if we want robust search, we need the flat Maps available.
    // Just searching "Added" for MVP to match functionality.

    const results = state[currentModalType].filter(s => (s.name || s).toLowerCase().includes(q));
    renderGrid(results);
}


function renderAllStations() {
    ['train', 'mrt', 'bus', 'bike'].forEach(type => {
        const container = document.getElementById(`${type}-list`);
        if (container) {
            container.innerHTML = '';
            state[type].forEach((s, idx) => {
                const div = document.createElement('div');
                div.className = 'station-tag';
                // Add Map Link
                const name = s.name || s;
                div.innerHTML = `
                    ${name} 
                    ${getMapLinkHtml(name, s.lat, s.lng)}
                    <span class="remove-icon" onclick="removeStation('${type}', ${idx})">×</span>
                `;
                container.appendChild(div);
            });
        }
    });
}

function removeStation(type, idx) {
    if (confirm('刪除此站點？')) {
        state[type].splice(idx, 1);
        saveState();
        renderAllStations();
    }
}

function clearSearch() {
    document.getElementById('modalSearch').value = '';
    filterStations('');
}

function checkKeyStatus() {
    const key = state.settings.apiKey;
    const btn = document.getElementById('sendBtn');
    if (!key) {
        btn.disabled = true;
        btn.innerText = "❌ 請先設定 API Key";
        btn.style.background = "#333";
    } else {
        btn.disabled = false;
        btn.innerText = "📍 根據設定取得 GPS 並查詢";
        btn.style.background = ""; // reset
    }
}

function checkSettingsAndPrompt() {
    // If no work/home station, prompt settings
    if (!state.settings.workLastMile.name && !state.settings.homeLastMile.name) {
        // setTimeout(() => {
        //     if(confirm("歡迎！請先設定上下班地點與交通方式，以獲得最佳體驗。是否現在設定？")) {
        //         openSettings();
        //     }
        // }, 1000);
    }
}

function renderResult(type, list) {
    const div = document.getElementById(`${type}-result`);
    if (div) {
        div.innerHTML = '';
        if (!list || list.length === 0) {
            div.innerHTML = '<span style="color:#666">無建議</span>';
            return;
        }
        list.forEach(t => {
            const d = document.createElement('div');
            // Handle both string and object (AI returns objects now)
            const name = (typeof t === 'object' && t.name) ? t.name : t;
            const lat = (typeof t === 'object' && t.lat) ? t.lat : null;
            const lng = (typeof t === 'object' && t.lng) ? t.lng : null;

            d.innerHTML = `
                ${name} 
                ${getMapLinkHtml(name, lat, lng)}
            `;
            d.style.padding = "5px 0";
            d.style.borderBottom = "1px solid #333";
            div.appendChild(d);
        });
    }
}

function renderItineraries(list) {
    const div = document.getElementById('itinerary-result');
    if (div) {
        div.innerHTML = '';
        if (!list || list.length === 0) {
            div.innerHTML = '<span style="color:#666">無建議方案</span>';
            return;
        }
        list.forEach(i => {
            const item = document.createElement('div');
            item.style.marginBottom = "15px";
            item.style.padding = "10px";
            item.style.background = "rgba(255,255,255,0.05)";
            item.style.borderRadius = "8px";

            // Add map link to title if possible? Detailed steps are text.
            // Maybe just keep text. User asked for "Stations... add links". 
            // Itinerary details might mention stations. It's hard to parse.
            // I'll leave itinerary text as is, or add a generic "Map" link for the title?
            // "Title" is usually "Option A". Not map-able.
            // "Details" contains route. 
            // I'll stick to the requested "Four major blocks" (Result lists) and "Stations" (Grid/Added list).

            item.innerHTML = `
                <div style="color:var(--accent-color); font-weight:bold; margin-bottom:5px;">${i.title || '方案'} <span style="float:right; font-size:0.9em; color:#fff;">⏱ ${i.time || '?'}</span></div>
                <div style="font-size:0.9em; color:#ddd;">${i.details || ''}</div>
            `;
            div.appendChild(item);
        });
    }
}

function updatePromptPreview() {
    const preview = document.getElementById('promptPreview');
    if (!preview) return;

    const mode = getCommuteMode();
    let text = ``;

    if (mode === 'late_night') {
        text += `(範例) 現在是 深夜時段 (00:00-05:00)。\n`;
        text += `⚠️ 強制鎖定: 僅顯示 YouBike (Ubike)`;
    } else if (mode === 'work') {
        text += `(範例) 現在是 接近上班時間。\n`;
        text += `啟用的交通工具: ${state.settings.workTrans.join(', ')}`;
        if (state.settings.workLastMile.name) {
            text += `\n🏁 終點站: ${state.settings.workLastMile.name} (${state.settings.workLastMile.trans.join('/')})`;
        }
    } else {
        text += `(範例) 現在是 下班/其他時間。\n`;
        text += `啟用的交通工具: ${state.settings.homeTrans.join(', ')}`;
        if (state.settings.homeLastMile.name) {
            text += `\n🏁 終點站: ${state.settings.homeLastMile.name} (${state.settings.homeLastMile.trans.join('/')})`;
        }
    }

    preview.value = text;
}

function handleSend() {
    const mode = getCommuteMode();

    if (mode === 'late_night') {
        alert("公共交通只剩下Ubike");
    }

    // Pass logic to createCommutePrompt to ensure consistency
    createCommutePrompt(mode).then(prompt => {
        callGeminiAPI(prompt);
    });
}

// --- NEW: BUS SEARCH UI ---
function renderBusSearchUI() {
    const sb = document.getElementById('modalSidebar');
    sb.innerHTML = ''; // Clear existing categories

    const container = document.createElement('div');
    container.style.padding = "10px";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";

    // City Dropdown
    const citySelect = document.createElement('select');
    citySelect.id = 'busCitySelect';
    citySelect.className = 'form-select'; // Reuse style if exists, else default
    citySelect.style.width = "100%";
    citySelect.style.padding = "8px";
    citySelect.style.background = "#222";
    citySelect.style.color = "#fff";
    citySelect.style.border = "1px solid #444";
    citySelect.style.borderRadius = "4px";

    // Populate Cities
    if (typeof TAIWAN_AREAS !== 'undefined') {
        const cities = Object.keys(TAIWAN_AREAS);
        cities.forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.innerText = city;
            citySelect.appendChild(opt);
        });
    }
    // Set default?
    citySelect.value = "桃園市";

    // District Dropdown
    const distSelect = document.createElement('select');
    distSelect.id = 'busDistrictSelect';
    distSelect.style.width = "100%";
    distSelect.style.padding = "8px";
    distSelect.style.background = "#222";
    distSelect.style.color = "#fff";
    distSelect.style.border = "1px solid #444";
    distSelect.style.borderRadius = "4px";

    // Update Districts on City Change
    const updateDistricts = () => {
        const city = citySelect.value;
        const districts = (typeof TAIWAN_AREAS !== 'undefined') ? (TAIWAN_AREAS[city] || []) : [];
        distSelect.innerHTML = '';
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.innerText = d;
            distSelect.appendChild(opt);
        });
        // Default district?
        if (districts.includes("中壢區")) distSelect.value = "中壢區";
    };
    citySelect.onchange = updateDistricts;

    // Labels
    const l1 = document.createElement('label'); l1.innerText = "1. 選擇縣市"; l1.style.color = "#aaa"; l1.style.fontSize = "0.9em";
    const l2 = document.createElement('label'); l2.innerText = "2. 選擇區域"; l2.style.color = "#aaa"; l2.style.fontSize = "0.9em";
    const l3 = document.createElement('label'); l3.innerText = "3. 輸入站點關鍵字 (右上方搜尋框)"; l3.style.color = "#aaa"; l3.style.fontSize = "0.9em";

    // Action Button
    const searchBtn = document.createElement('button');
    searchBtn.innerText = "🔍 搜尋公車";
    searchBtn.className = 'btn-primary';
    searchBtn.style.marginTop = "10px";
    searchBtn.onclick = () => {
        const city = document.getElementById('busCitySelect').value;
        const dist = document.getElementById('busDistrictSelect').value;
        const kw = document.getElementById('modalSearch').value;

        if (!kw) {
            alert("請輸入關鍵字");
            return;
        }

        const fullQuery = `${city} ${dist} ${kw} 公車站`;
        askGeminiForStations(fullQuery, 'bus');
    };

    container.appendChild(l1);
    container.appendChild(citySelect);
    container.appendChild(l2);
    container.appendChild(distSelect);
    container.appendChild(l3);
    container.appendChild(searchBtn);

    sb.appendChild(container);

    // Init districts
    updateDistricts();

    // Add "Added" list at bottom of sidebar?
    const div = document.createElement('div');
    div.className = 'category-item active';
    div.innerText = "已新增列表";
    div.style.marginTop = "20px";
    div.style.borderTop = "1px solid #444";
    div.onclick = () => renderGrid(state['bus']);
    sb.appendChild(div);

    // Initial render of added stations
    renderGrid(state['bus']);
}
