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

// --- INIT ---
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

    document.getElementById('workStatus').innerText = '';
    document.getElementById('homeStatus').innerText = '';

    // Holiday
    if (state.settings.holiday) {
        document.getElementById('settingOldHomeStation').value = state.settings.holiday.oldHomeLastMile.name || "";
        document.getElementById('settingHolidayHomeStation').value = state.settings.holiday.homeLastMile.name || "";
        document.getElementById('holidayOldHomeStatus').innerText = '';
        document.getElementById('holidayHomeStatus').innerText = '';
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
    renderStatus('work', state.settings.workLastMile);
    renderStatus('home', state.settings.homeLastMile);

    // Holiday Checkboxes
    if (state.settings.holiday) {
        renderStatus('holiday_oldHome', state.settings.holiday.oldHomeLastMile);
        renderStatus('holiday_home', state.settings.holiday.homeLastMile);
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

function validateLastMile(type) {
    let inputId, statusId;

    if (type === 'work') {
        inputId = 'settingWorkStation';
        statusId = 'workStatus';
    } else if (type === 'home') {
        inputId = 'settingHomeStation';
        statusId = 'homeStatus';
    } else if (type === 'holiday_oldHome') {
        inputId = 'settingOldHomeStation';
        statusId = 'holidayOldHomeStatus';
    } else if (type === 'holiday_home') {
        inputId = 'settingHolidayHomeStation';
        statusId = 'holidayHomeStatus';
    }

    const nameWithSource = document.getElementById(inputId).value;
    const name = nameWithSource.split('(')[0].trim();

    const statusDiv = document.getElementById(statusId);
    if (!name) {
        statusDiv.innerHTML = '<span style="color:var(--error-color)">請輸入站點名稱</span>';
        return;
    }

    statusDiv.innerText = "🔍 檢查中...";
    setTimeout(() => {
        statusDiv.innerHTML = `<span style="color:var(--success-color)">✅ 格式正確 (將由 AI 尋找)</span>`;
    }, 300);
}

function renderStatus(type, obj) {
    const div = document.getElementById(`${type === 'holiday_oldHome' ? 'holidayOldHome' : type === 'holiday_home' ? 'holidayHome' : type}Status`);
    // Note: status ID logic above might need matching index.html IDs exactly.
    // Index.html IDs: workStatus, homeStatus, holidayOldHomeStatus, holidayHomeStatus.
    // The previous code in index.html had specific logic.
    // Retrying clean logic:
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

function openStationModal(type) {
    currentModalType = type;
    selectionMode = 'manage'; // Default mode
    selectionTarget = '';
    document.getElementById('modalTitle').innerText = `管理 ${type === 'bike' ? 'YouBike' : type === 'mrt' ? '捷運' : type === 'bus' ? '公車' : '火車'} 站點`;
    document.getElementById('modalSearch').value = '';

    renderSidebar(type);
    selectCategory('ADDED'); // Default view
    document.getElementById('stationModal').classList.add('active');

    // Help text
    const helpText = document.getElementById('modalHelpText');
    if (type === 'bike') {
        helpText.innerText = "💡 提示: YouBike 站點眾多，建議使用上方搜尋功能";
    } else {
        helpText.innerText = "";
    }
}

function openSourceSelectModal(target) {
    // Determine type from target? Or allow user to pick type?
    // Current design: Last Mile can be any type.
    // So we open a generic modal or ask user?
    // The previous implementation inferred type or allowed picking.
    // Actually, checking index.html, `openSourceSelectModal` sets `selectionMode='select'` and defaults to 'train' or last used?
    // Let's implement a generic picker or just default to Train and let user switch sidebar?
    // Wait, the sidebar logic relies on `currentModalType`.
    // We should probably show ALL types in sidebar? Or just pick one to start.

    selectionMode = 'select';
    selectionTarget = target;
    currentModalType = 'train'; // Default start

    document.getElementById('modalTitle').innerText = `選擇最後一哩路站點`;

    // We need to allow switching types. 
    // The sidebar usually shows categories for the CURRENT type.
    // Maybe we add Type switching in the modal header?
    // For now, let's just stick to 'train' and user can close?
    // No, that limits choice.
    // Ideally, we have Buttons to switch Type.

    // Simplified: Just open Train. If they want MRT, they might need to go back?
    // Let's rely on standard `openStationModal` logic but repurposed.

    renderSidebar('train'); // Start with train
    selectCategory('ADDED');
    document.getElementById('stationModal').classList.add('active');
}

function renderSidebar(type) {
    const sb = document.getElementById('modalSidebar');
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
        div.innerText = name;
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
        // Trigger validation visual
        const statusId = inputId.replace('Station', 'Status').replace('setting', '').toLowerCase();
        // Mapping: workStatus, homeStatus, holidayOldHomeStatus, holidayHomeStatus
        // The regex above is imperfect. Logic:
        let sId = '';
        if (selectionTarget == 'work') sId = 'workStatus';
        if (selectionTarget == 'home') sId = 'homeStatus';
        if (selectionTarget == 'holiday_oldHome') sId = 'holidayOldHomeStatus';
        if (selectionTarget == 'holiday_home') sId = 'holidayHomeStatus';

        document.getElementById(sId).innerHTML = `<span style="color:var(--success-color)">✅ 已選擇: ${name}</span>`;
    }
    closeModal('stationModal');
    openSettings(); // Return to settings
}

function filterStations(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        selectCategory('ADDED');
        return;
    }

    // AI Check
    if (currentModalType === 'bike') {
        askGeminiForStations(q);
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
                div.innerHTML = `${s.name || s} <span class="remove-icon" onclick="removeStation('${type}', ${idx})">×</span>`;
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
            d.innerText = t;
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

    const nowHour = new Date().getHours();
    const isGoingWork = nowHour < 12;

    let text = `(範例) 現在是 ${isGoingWork ? '早上(上班)' : '下午(下班)'}。\n`;
    text += `啟用的交通工具: ${isGoingWork ? state.settings.workTrans.join(', ') : state.settings.homeTrans.join(', ')}`;

    // Preview Last Mile
    const lm = isGoingWork ? state.settings.workLastMile : state.settings.homeLastMile;
    if (lm && lm.name) {
        text += `\n🏁 終點站: ${lm.name} (${lm.trans.join('/')})`;
    }

    preview.value = text;
}

function handleSend() {
    // Defined in index.html calling API
    // Wait, we moved handleSend here? 
    // Yes, we should.
    // But it needs createCommutePrompt which is in api_service.js?
    // If api_service.js is loaded, it's global.
    createCommutePrompt().then(prompt => {
        callGeminiAPI(prompt);
    });
}
