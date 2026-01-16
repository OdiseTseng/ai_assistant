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

let currentDashboardTab = 'daily'; // daily, oldHome, custom

function switchDashboardTab(tab) {
    currentDashboardTab = tab;
    // Update Buttons
    const btns = document.querySelectorAll('.dashboard-tab-btn');

    btns.forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${tab}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update Content
    document.querySelectorAll('.dashboard-tab-content').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`tab-${tab}`);
    if (target) {
        target.classList.add('active');
    }

    // Refresh stations if needed
    if (tab === 'oldHome' || tab === 'daily') {
        setTimeout(renderAllStations, 0);
    }
}

// --- HELPER: TIME LOGIC ---


// --- HOLIDAY LOGIC ---
let holidayCache = {}; // { "20260101": { isHoliday: true, name: "元旦" } }

async function fetchHolidayData() {
    // Try to fetch TW Calendar (Using a reliable JSON source for 2026 if available, else mock/weekend)
    // Source: Government Open Data or a mirror. 
    // For 2025/2026, data might be scarce. Let's use a logic-based fallback + fetch.
    const year = new Date().getFullYear();
    try {
        const res = await fetch(`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`);
        // If not found, it might throw or 404.
        if (res.ok) {
            const data = await res.json();
            data.forEach(d => {
                // Format: d.date = "20260101"
                holidayCache[d.date] = { isHoliday: d.isHoliday, name: d.description };
            });
        }
    } catch (e) {
        console.warn("Holiday data fetch failed:", e);
    }
}

// Call on init
fetchHolidayData();

function isHoliday(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const key = `${y}${m}${d}`;
    const dayOfWeek = dateObj.getDay();

    if (holidayCache[key]) {
        return holidayCache[key].isHoliday;
    }
    // Fallback: Weekend
    return (dayOfWeek === 0 || dayOfWeek === 6);
}

// Override getCommuteMode with advanced logic
function getCommuteMode(mockDate = null) {
    const now = mockDate || new Date();
    const hour = now.getHours();

    // 0. Late Night (00-05)
    if (hour >= 0 && hour < 5) return 'late_night';

    const todayHoliday = isHoliday(now);

    // Check Tomorrow for Pre-Holiday Logic
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowHoliday = isHoliday(tomorrow);

    // Check Yesterday for Post-Holiday Logic
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayHoliday = isHoliday(yesterday);

    // 1. Pre-Holiday Afternoon (Workday -> Holiday)
    // If today is NOT holiday, but tomorrow IS holiday, and time >= 12:00
    if (!todayHoliday && tomorrowHoliday && hour >= 12) {
        return 'old_home'; // Go to Old Home
    }

    // 2. Post-Holiday Morning (Holiday -> Workday)
    // If yesterday WAS holiday, today is NOT holiday, and time < 12:00
    if (yesterdayHoliday && !todayHoliday && hour < 12) {
        return 'work'; // Back to Work (should match default work logic, but explicit priority)
    }

    // 3. Normal Work Logic
    // If it's a workday
    if (!todayHoliday) {
        if (state.settings.workTime) {
            const [wHour, wMinute] = state.settings.workTime.split(':').map(Number);
            const currentMinutes = hour * 60 + now.getMinutes();
            const workMinutes = wHour * 60 + wMinute;
            // Work time +/- 3 hours
            if (Math.abs(currentMinutes - workMinutes) <= 180) {
                return 'work';
            }
        }
    } else {
        // It IS a holiday. Default to 'home' or 'old_home'? 
        // User asked for "Back to Old Home" logic.
        // Usually on holiday you are AT old home or going OUT.
        // Let's stick to 'home' (which means "Not Commuting") unless specified.
        // Or if user wants "Return from Old Home to Work Home"?
        // Logic: Post-holiday morning handles the return.
    }

    // 4. Default
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

        // --- AUTO TAB SWITCH LOGIC ---
        // Requirement:
        // 1. If Holiday -> Default to 'custom' (想去哪)
        // 2. If Weekday:
        //    - If within 3 hours of Work/Home time -> Default to 'daily' (Daily Commute)
        //    - Else -> Default to 'custom' (As implied by "holiday default custom" contrast, and usually idle time)

        const now = new Date();
        const isHol = isHoliday(now);

        if (isHol) {
            console.log("🌟 Holiday detected: Defaulting to Custom Tab");
            switchDashboardTab('custom');
        } else {
            // Weekday
            // Check if near commute time (using getCommuteMode logic without mode return)
            // We can reuse getCommuteMode() but it returns strings.
            // 'work' or 'home' implies implied proximity (logic is inside getCommuteMode)
            // actually getCommuteMode defaults to 'home' if not work, so it's not strictly "proximity".
            // Let's check proximity manually to be sure.

            let nearCommute = false;
            const hour = now.getHours();
            const minutes = now.getMinutes();
            const currentMinutes = hour * 60 + minutes;

            // Check Work Time
            if (state.settings.workTime) {
                const [wH, wM] = state.settings.workTime.split(':').map(Number);
                const workMins = wH * 60 + wM;
                if (Math.abs(currentMinutes - workMins) <= 180) nearCommute = true;
            }

            // Check Home Time
            if (state.settings.homeTime) {
                const [hH, hM] = state.settings.homeTime.split(':').map(Number);
                const homeMins = hH * 60 + hM;
                if (Math.abs(currentMinutes - homeMins) <= 180) nearCommute = true;
            }

            if (nearCommute) {
                console.log("💼 Commute Time detected: Defaulting to Daily Tab");
                switchDashboardTab('daily');
            } else {
                console.log("🕒 Off-peak Weekday: Defaulting to Custom Tab");
                switchDashboardTab('custom');
            }
        }

        // Version
        if (typeof BUILD_INFO !== 'undefined') {
            document.getElementById('versionInfo').innerText = `最後更新於 ${BUILD_INFO.time}`;
        }

        // Fetch YouBike Data if user has bike stations
        if (state.bike.length > 0) {
            // fetchYouBikeData is in api_service.js
            if (typeof fetchYouBikeData === 'function') {
                fetchYouBikeData().then(() => {
                    const bikeContainer = document.getElementById('bike-list');
                    if (bikeContainer) renderAllStations();
                });
            }
        }
    } catch (e) {
        console.error("❌ Init Error:", e);
    }
});

// --- Preference Persistence ---
function loadCustomPrefs() {
    try {
        const saved = localStorage.getItem('custom_transport_prefs');
        if (saved) {
            const prefs = JSON.parse(saved);
            ['prefTrain', 'prefMRT', 'prefBus', 'prefBike', 'prefWalk'].forEach(id => {
                const el = document.getElementById(id);
                if (el && prefs.hasOwnProperty(id)) {
                    el.checked = prefs[id];
                }
            });
        }
    } catch (e) {
        console.error("Failed to load custom prefs:", e);
    }

    // Attach listeners
    ['prefTrain', 'prefMRT', 'prefBus', 'prefBike', 'prefWalk'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveCustomPrefs);
        }
    });
}

function saveCustomPrefs() {
    const prefs = {};
    ['prefTrain', 'prefMRT', 'prefBus', 'prefBike', 'prefWalk'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            prefs[id] = el.checked;
        }
    });
    localStorage.setItem('custom_transport_prefs', JSON.stringify(prefs));
}

// Call load on DOMContentLoaded (adding to end of existing listener block logic via separate call if easier, or appending)
// Since we are outside the listener here, let's just add another listener or call it if script runs deferred.
// Script is defer? No, usually not. But we can just add another listener.
document.addEventListener('DOMContentLoaded', loadCustomPrefs);

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
    const wEl = document.getElementById('settingWorkStation');
    wEl.value = state.settings.workLastMile.name || "";
    wEl.dataset.lat = state.settings.workLastMile.coords ? state.settings.workLastMile.coords.lat : "";
    wEl.dataset.lng = state.settings.workLastMile.coords ? state.settings.workLastMile.coords.lng : "";

    const hEl = document.getElementById('settingHomeStation');
    hEl.value = state.settings.homeLastMile.name || "";
    hEl.dataset.lat = state.settings.homeLastMile.coords ? state.settings.homeLastMile.coords.lat : "";
    hEl.dataset.lng = state.settings.homeLastMile.coords ? state.settings.homeLastMile.coords.lng : "";

    // Holiday
    if (state.settings.holiday) {
        const oldHome = state.settings.holiday.oldHomeLastMile;
        const eOld = document.getElementById('settingOldHomeStation');
        eOld.value = oldHome.name || "";
        eOld.dataset.lat = oldHome.coords ? oldHome.coords.lat : "";
        eOld.dataset.lng = oldHome.coords ? oldHome.coords.lng : "";

        const holHome = state.settings.holiday.homeLastMile;
        const eHol = document.getElementById('settingHolidayHomeStation');
        eHol.value = holHome.name || "";
        eHol.dataset.lat = holHome.coords ? holHome.coords.lat : "";
        eHol.dataset.lng = holHome.coords ? holHome.coords.lng : "";
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

    // Helper to get coords
    const getCoords = (elId) => {
        const el = document.getElementById(elId);
        if (el.dataset.lat && el.dataset.lng) {
            return { lat: parseFloat(el.dataset.lat), lng: parseFloat(el.dataset.lng) };
        }
        return null;
    };

    // Weekday Last Mile
    const workVal = document.getElementById('settingWorkStation').value;
    state.settings.workLastMile.name = workVal;
    state.settings.workLastMile.trans = inferType(workVal);
    state.settings.workLastMile.coords = getCoords('settingWorkStation');

    const homeVal = document.getElementById('settingHomeStation').value;
    state.settings.homeLastMile.name = homeVal;
    state.settings.homeLastMile.trans = inferType(homeVal);
    state.settings.homeLastMile.coords = getCoords('settingHomeStation');

    // Holiday
    if (!state.settings.holiday) state.settings.holiday = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.holiday));

    const oldHomeVal = document.getElementById('settingOldHomeStation').value;
    state.settings.holiday.oldHomeLastMile.name = oldHomeVal;

    // Default en-route logic for holiday (since UI removed)
    state.settings.holiday.oldHomeTrans = ['train', 'mrt', 'bus', 'bike'];
    state.settings.holiday.oldHomeLastMile.trans = inferType(oldHomeVal);
    state.settings.holiday.oldHomeLastMile.coords = getCoords('settingOldHomeStation');

    const holHomeVal = document.getElementById('settingHolidayHomeStation').value;
    state.settings.holiday.homeLastMile.name = holHomeVal;
    state.settings.holiday.homeTrans = ['train', 'mrt', 'bus', 'bike'];
    state.settings.holiday.homeLastMile.trans = inferType(holHomeVal);
    state.settings.holiday.homeLastMile.coords = getCoords('settingHolidayHomeStation');

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

// --- DEBUG CONSOLE ---
window.lastDebugData = { prompt: "尚無查詢紀錄", response: "尚無回應紀錄", queryType: "gemini" }; // queryType: 'gemini' or 'search'

function openDebugModal(context = 'main') {
    // If context is 'modal' (from Station Modal), we might show different labels?
    // User requested: "If non-gemini-flash search, show 'Sent Query' field"

    // Logic: Look at window.lastDebugData.queryType
    const isGemini = window.lastDebugData.queryType === 'gemini';
    const label = document.getElementById('debugPromptLabel');
    if (label) {
        label.innerText = isGemini ? "📤 Sent Prompt" : "📤 Sent Query";
    }

    document.getElementById('debugPrompt').value = window.lastDebugData.prompt;

    const responseText = typeof window.lastDebugData.response === 'object'
        ? JSON.stringify(window.lastDebugData.response, null, 2)
        : window.lastDebugData.response;
    document.getElementById('debugResponse').value = responseText;

    // Ensure modal appears on top if called from another modal?
    const modal = document.getElementById('debugModal');
    modal.classList.add('active');

    if (context === 'modal') {
        modal.style.zIndex = "20000"; // Higher than stationModal
    } else {
        modal.style.zIndex = "";
    }
}

function simulateRendering() {
    let raw = document.getElementById('debugResponse').value;
    if (!raw) return alert("❌ 請輸入 JSON");

    try {
        let json;
        // 1. Try to parse as Object first
        let parsedObj;
        try {
            parsedObj = JSON.parse(raw);
        } catch (e) {
            // Raw text might be OK if it's just markdown
        }

        // 2. Check if it's the full raw Gemini response structure
        if (parsedObj && parsedObj.candidates && parsedObj.candidates[0].content) {
            raw = parsedObj.candidates[0].content.parts[0].text;
        }

        // 3. Extract JSON from Markdown (e.g. ```json ... ```)
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            json = JSON.parse(jsonMatch[0]);
        } else {
            // Fallback: try using the parsed object directly if it wasn't a raw response
            json = parsedObj || JSON.parse(raw);
        }

        // Render Results
        // Render Results
        console.log("Simulating with:", json);

        // Fix for Tab-Context Simulation
        // Fix for Tab-Context Simulation
        let renderSuffix = ''; // Default Daily
        if (typeof currentDashboardTab !== 'undefined') {
            if (currentDashboardTab === 'oldHome') {
                window.currentItineraryTarget = 'itinerary-result-oldHome';
                renderSuffix = '-2';
            }
            else if (currentDashboardTab === 'custom') {
                window.currentItineraryTarget = 'itinerary-result-custom';
                renderSuffix = '-3';
            }
            else {
                window.currentItineraryTarget = 'itinerary-result';
                renderSuffix = '';
            }
        }

        renderResult('train', json.train, renderSuffix);
        renderResult('mrt', json.mrt, renderSuffix);
        renderResult('bus', json.bus, renderSuffix);
        renderResult('bike', json.bike, renderSuffix);

        // Render Itinerary
        renderItineraries(json.itineraries);

        closeModal('debugModal');
        alert("✅ 模擬渲染完成");
    } catch (e) {
        alert("❌ JSON 解析錯誤: " + e.message);
        console.error(e);
    }
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

    const searchInput = document.getElementById('modalSearch');
    searchInput.value = '';
    searchInput.style.display = type === 'bus' ? 'none' : 'block';

    const helpText = document.getElementById('modalHelpText');
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
// --- HELPER: MAP LINK ---
function getMapLinkHtml(name, lat, lng, text) {
    const url = (lat && lng)
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
    const content = (text || name || '').trim();
    return `<a href="${url}" target="_blank" style="text-decoration:none; color:inherit; cursor:pointer; display:inline;" onclick="event.stopPropagation()">${content}</a>`;
}

// --- HELPER: MODAL CONTROL ---
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Ensure global scope for HTML onclick
window.openModal = openModal;
window.closeModal = closeModal;


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
            ${getMapLinkHtml(name, item.lat, item.lng, name)}
        `;

        if (item.lat || (typeof item === 'object' && item.lat)) {
            div.innerHTML += '<span style="display:block;font-size:0.7em;color:gray">📍</span>';
        }

        // Selected state (Only show in 'manage' mode)
        if (selectionMode === 'manage' && state[currentModalType].some(s => (s.name || s) === name)) {
            div.classList.add('selected');
        }

        div.onclick = (e) => toggleStation(item, e.currentTarget);
        grid.appendChild(div);
    });
}

// ... lines omitted ...



function toggleStation(item, element = null) {
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
        if (element && currentCategory !== 'ADDED') {
            element.classList.remove('selected');
        }
    } else {
        // Ensure object structure
        list.push(typeof item === 'object' ? item : { name: item, lat: null, lng: null });
        if (element && currentCategory !== 'ADDED') {
            element.classList.add('selected');
        }
    }

    saveState();
    // Only re-render if in "ADDED" view, otherwise just update the style of the clicked element
    if (currentCategory === 'ADDED' || !element) {
        renderAllStations();
        if (currentCategory === 'ADDED') {
            renderGrid(state[currentModalType]);
        }
    } else {
        // Background update for main dashboard list
        renderAllStations();
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
    else if (selectionTarget === 'custom') inputId = 'customDestInput';


    if (inputId) {
        // For custom, maybe we don't want the (Type) suffix?
        // User might want just the name. But validation handles "Name (Type)" fine usually.
        // Let's use formatted name for clarity.
        const el = document.getElementById(inputId);
        el.value = formattedName;
        // Store Coords in dataset for saving
        if (item.lat && item.lng) {
            el.dataset.lat = item.lat;
            el.dataset.lng = item.lng;
        } else {
            // Clear if none
            delete el.dataset.lat;
            delete el.dataset.lng;
        }
    }
    closeModal('stationModal');
    // openSettings(); // Do not reload settings
}

let searchTimeout = null;

function filterStations(query) {
    const q = query.trim().toLowerCase();

    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);

    if (!q) {
        selectCategory('ADDED');
        return;
    }


    // Show "Searching..." immediately
    const grid = document.getElementById('modalGrid');
    grid.innerHTML = '<span style="color:#666; grid-column:1/-1; text-align:center;">🔍 搜尋中...</span>';

    // Set new timeout (2 seconds debounce)
    searchTimeout = setTimeout(() => {
        // AI Check / Official Search
        if (currentModalType === 'bike') {
            askGeminiForStations(q, 'bike');
            return;
        }

        grid.innerHTML = '';

        // Local Filter for other types (Train/MRT/Bus/Added)
        const results = state[currentModalType].filter(s => (s.name || s).toLowerCase().includes(q));
        renderGrid(results);
    }, 2000);
}



function renderAllStations() {
    ['train', 'mrt', 'bus', 'bike'].forEach(type => {
        // Target Main (Daily), Secondary (OldHome), and Tertiary (Custom) lists
        const suffixes = ['', '-2', '-3'];

        suffixes.forEach(suffix => {
            const container = document.getElementById(`${type}-list${suffix}`);
            if (container) {
                container.innerHTML = '';
                state[type].forEach((s, idx) => {
                    const div = document.createElement('div');
                    div.className = 'station-tag';
                    const name = s.name || s;
                    let extraInfo = '';

                    div.innerHTML = `
                        ${getMapLinkHtml(name, s.lat, s.lng, name)}${extraInfo}<span class="remove-icon" onclick="removeStation('${type}', ${idx})">×</span>
                    `;
                    container.appendChild(div);
                });
            }
        });
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
    const btns = ['sendBtn', 'sendBtnOldHome', 'sendBtnCustom'];

    btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            if (!key) {
                btn.disabled = true;
                // Only change text for the main button or all?
                // Let's keep original text logic or simple override.
                // For simplicity:
                if (id === 'sendBtn') btn.innerText = "❌ 請先設定 API Key";
                btn.style.background = "#333";
            } else {
                btn.disabled = false;
                if (id === 'sendBtn') btn.innerText = "📍 根據設定取得 GPS 並查詢";
                btn.style.background = ""; // reset
            }
        }
    });
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

// Helper to get bike info HTML
function getBikeInfoHtml(name) {
    if (!window.youBikeRealTimeMap || !window.youBikeRealTimeMap[name]) return '';
    const info = window.youBikeRealTimeMap[name];
    // Color code: Green > 5, Orange > 0, Red = 0
    const rentColor = info.rent > 3 ? '#4ade80' : (info.rent > 0 ? '#fbbf24' : '#ef4444');
    // Return: Empty spaces for return
    const returnColor = info.return > 3 ? '#4ade80' : (info.return > 0 ? '#fbbf24' : '#ef4444');

    return `<span style="font-size:0.8em; margin-left:5px; color:#aaa;">
        (借:<span style="color:${rentColor}; font-weight:bold;">${info.rent}</span> / 還:<span style="color:${returnColor}; font-weight:bold;">${info.return}</span>)
    </span>`;
}

function renderResult(type, list, targetSuffix = '') {
    // Determine which container to update based on targetSuffix
    // targetSuffix: '' (Daily), '-2' (OldHome), '-3' (Custom)
    const suffix = targetSuffix || '';

    const div = document.getElementById(`${type}-result${suffix}`);
    if (div) {
        div.innerHTML = '';


        // Always show Title "搭乘順序"
        const title = document.createElement('h4');
        title.innerText = "搭乘順序";
        title.style.margin = "0 0 10px 0";
        title.style.color = "var(--accent-color)";
        div.appendChild(title);

        if (!list || list.length === 0) {
            const span = document.createElement('span');
            span.style.color = "#666";
            span.innerText = "無建議";
            div.appendChild(span);
            return;
        }

        list.forEach(t => {
            const d = document.createElement('div');
            d.style.padding = "10px";
            d.style.marginBottom = "10px";
            d.style.borderBottom = "1px solid #333";
            d.style.background = "rgba(255,255,255,0.02)";
            d.style.borderRadius = "5px";

            // Check if it's a Flow Object (Start -> End)
            if (typeof t === 'object' && t.from && t.to) {
                const lineInfo = t.line ? ` - ${t.line}` : '';

                // Special Format for Bus: "Station - Board [Routes]"
                if (type === 'bus') {
                    d.innerHTML = `
                        <div style="font-weight:bold">${getMapLinkHtml(t.from, t.lat_from, t.lng_from)} <span style="font-weight:normal; color:#aaa"> -搭乘 ${t.line || '公車'}</span></div>
                        <div style="text-align:center; color:var(--accent-color); margin: 5px 0;">↓</div>
                        <div style="font-weight:bold">${getMapLinkHtml(t.to, t.lat_to, t.lng_to)} <span style="font-weight:normal; color:#aaa"> -下車</span></div>
                    `;
                } else if (type === 'bike') {
                    // Bike Format: "Station - Rent" ... "Station - Return"
                    const fromInfo = getBikeInfoHtml(t.from);
                    const toInfo = getBikeInfoHtml(t.to);

                    d.innerHTML = `
                        <div style="font-weight:bold">${getMapLinkHtml(t.from, t.lat_from, t.lng_from)} ${fromInfo} <span style="font-weight:normal; color:#aaa"> -租車</span></div>
                        <div style="text-align:center; color:var(--accent-color); margin: 5px 0;">↓</div>
                        <div style="font-weight:bold">${getMapLinkHtml(t.to, t.lat_to, t.lng_to)} ${toInfo} <span style="font-weight:normal; color:#aaa"> -還車</span></div>
                    `;
                } else {
                    // Default Format for Train/MRT: "Station - Board" ... "Station - Get Off"
                    d.innerHTML = `
                        <div style="font-weight:bold">${getMapLinkHtml(t.from, t.lat_from, t.lng_from)} <span style="font-weight:normal; color:#aaa"> -上車${lineInfo}</span></div>
                        <div style="text-align:center; color:var(--accent-color); margin: 5px 0;">↓</div>
                        <div style="font-weight:bold">${getMapLinkHtml(t.to, t.lat_to, t.lng_to)} <span style="font-weight:normal; color:#aaa"> -下車</span></div>
                    `;
                }
            } else {
                // Fallback for old simple list or simple objects
                let name = t;
                let lat = null; let lng = null;
                if (typeof t === 'object' && t !== null) {
                    name = t.name || t.station || t.stop || t.title || JSON.stringify(t);
                    lat = t.lat || null;
                    lng = t.lng || null;
                }

                d.innerHTML = `
                    ${getMapLinkHtml(typeof name === 'string' ? name : JSON.stringify(name), lat, lng)}
                `;
            }
            div.appendChild(d);
        });
    }
}

function renderItineraries(list) {
    const targetId = window.currentItineraryTarget || 'itinerary-result';
    const div = document.getElementById(targetId);
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

            // Title & Time Resolution
            const title = i.title || i.mode || '方案';
            const time = i.time || i.total_duration || '?';

            // Content Resolution
            // Priority: details (string) > steps (array) > summary (string)
            let rawContent = '';

            if (i.details) {
                rawContent = i.details;
            } else if (i.steps && Array.isArray(i.steps)) {
                // Construct HTML from Steps
                let stepsHtml = i.steps.map((step, idx) => {
                    const typeIcon = {
                        walk: '🚶',
                        mrt: '🚇',
                        bus: '🚌',
                        train: '🚆',
                        bike: '🚲',
                        transfer: '🔄'
                    }[step.type] || '📍';

                    let instruction = step.instruction || '前往下一站';

                    // Highlight line info if available
                    if (step.line_name) {
                        instruction = `<span style="color:#fbbf24; font-weight:bold;">[${step.line_name}]</span> ` + instruction;
                    }

                    return `
                    <div style="display:flex; gap:10px; margin-bottom:8px; line-height:1.4;">
                        <span style="font-size:1.2em;">${typeIcon}</span>
                        <div>
                            <span style="font-weight:bold; color:#ddd;">Step ${idx + 1}</span><br>
                            <span style="color:#bbb;">${instruction}</span>
                        </div>
                    </div>`;
                }).join('');

                rawContent = stepsHtml;

                // Append Summary if available
                if (i.summary) {
                    rawContent += `<div style="margin-top:10px; padding-top:10px; border-top:1px dashed #444; color:#94a3b8;">📝 ${i.summary}</div>`;
                }
            } else if (i.summary) {
                rawContent = i.summary;
            }

            // Apply Formatting (Bold, Links, Line Breaks)
            let html = (rawContent || '')
                // Line breaks: Match "digits + dot + space" to avoid breaking coordinates (e.g. 25.04)
                .replace(/(\d+\.\s)/g, '<br>$1')
                // Bold text
                .replace(/\*\*(.*?)\*\*/g, '<span style="color:var(--accent-color); font-weight:bold;">$1</span>')
                // Coordinates Link: Name (lat, lng)
                .replace(/([^\:：，,。;；<>\n]+)\s*\(\s*(\d+\.\d+)\s*,\s*(\d+\.\d+)\s*\)/g, (match, text, lat, lng) => {
                    let cleanText = text.trim();
                    let preText = "";
                    let prefix = "";

                    // Cleanup leading punctuation often caught by broad match (e.g. ": ", ", ")
                    cleanText = cleanText.replace(/^[:：,，\.\s]+/, '');

                    // Common prepositions to split out of the link
                    const prepositions = ['從', '至', '往', '到', '在'];
                    let lastPrepIndex = -1;
                    let matchedPrep = "";

                    for (const p of prepositions) {
                        const idx = cleanText.lastIndexOf(p);
                        if (idx > lastPrepIndex) {
                            lastPrepIndex = idx;
                            matchedPrep = p;
                        }
                    }

                    if (lastPrepIndex !== -1) {
                        preText = cleanText.substring(0, lastPrepIndex);
                        prefix = matchedPrep;
                        cleanText = cleanText.substring(lastPrepIndex + matchedPrep.length).trim();
                    }

                    return `${preText}${prefix}${getMapLinkHtml(cleanText, lat, lng, `<b>${cleanText}</b>`)}`;
                });

            const formattedDetails = html;

            item.innerHTML = `
                <div style="color:var(--accent-color); font-weight:bold; margin-bottom:5px;">${title} <span style="float:right; font-size:0.9em; color:#fff;">⏱ ${time}</span></div>
                <div style="font-size:0.9em; color:#ddd; line-height: 1.6;">${formattedDetails}</div>
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

function handleSend(overrideMode = null) {
    const mode = overrideMode || getCommuteMode();

    if (mode === 'late_night') {
        alert("公共交通只剩下Ubike");
    }

    // Determine target Itinerary ID based on mode/tab
    window.currentItineraryTarget = (overrideMode === 'old_home') ? 'itinerary-result-oldHome' : 'itinerary-result';

    // Determine Suffix
    // old_home -> '-2', normal/work/late_night -> '' (Daily)
    const suffix = (overrideMode === 'old_home') ? '-2' : '';

    createCommutePrompt(mode).then(prompt => {
        // If overriding (e.g. old_home), we might want to target a specific button for loading state?
        // simple default 'sendBtn' or 'sendBtnOldHome'
        const btnId = (overrideMode === 'old_home') ? 'sendBtnOldHome' : 'sendBtn';
        callGeminiAPI(prompt, btnId, suffix);
    });
}

// --- CUSTOM ROUTE ---
// --- DEBUG HELPER ---
function logDebugOther(query, response, source = "API") {
    const el = document.getElementById('debugOtherApiLog');
    if (!el) return;

    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] [${source}]\nQ: ${query}\nA: ${typeof response === 'object' ? JSON.stringify(response, null, 2) : response}\n----------------------------------------\n`;

    // Prepend (newest first)
    el.value = entry + el.value;
}

// --- CUSTOM ROUTE ---
async function searchLocationNominatim(query) {
    try {
        // Increase limit to 10 to get diverse options
        // Added accept-language=zh-TW to prefer Traditional Chinese
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&countrycodes=tw&accept-language=zh-TW`;

        // Log Query
        logDebugOther(url, "Requesting...", "Nominatim (Map)");

        const res = await fetch(url);
        if (!res.ok) throw new Error("Map Service Unavailable");

        const data = await res.json();

        // Log Response
        logDebugOther(query, data, "Nominatim (Map)");

        if (data && data.length > 0) {
            // Map raw data to cleaner internal format
            return data.map(place => ({
                valid: true,
                formatted_name: place.display_name,
                lat: parseFloat(place.lat),
                lng: parseFloat(place.lon),
                source: 'OSM/Nominatim'
            }));
        }
    } catch (e) {
        console.warn("Nominatim search failed:", e);
        logDebugOther(query, "Error: " + e.message, "Nominatim (Map)");
    }
    return null; // Not found or error
}

async function verifyLocationAI(dest, key) {
    const verifyPrompt = `請驗證地點「${dest}」是否為台灣真實存在的地點或地標。
    如果是，請提供它的精確經緯度。
    回傳 JSON: { "valid": true, "formatted_name": "完整名稱", "lat": 25.xxx, "lng": 121.xxx }
    如果不存在或不明確，回傳 { "valid": false, "reason": "原因" }`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: verifyPrompt }] }] })
    });
    const data = await res.json();
    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const json = jsonMatch ? JSON.parse(jsonMatch[0]) : { valid: false };

    if (json.valid) {
        json.source = 'AI_Verify';
        return [json]; // Return as array for consistency
    }
    return null;
}

function handleCustomRoute() {
    const input = document.getElementById('customDestInput');
    const dest = input.value.trim();
    if (!dest) return alert("請輸入目的地");

    const btn = document.getElementById('sendBtnCustom');
    const status = document.getElementById('custom-status');
    const key = state.settings.apiKey;

    if (!key) return alert("請先設定 API Key");

    if (btn) btn.disabled = true;
    if (status) {
        status.innerText = "🔍 搜尋地圖資料中...";
        status.style.color = "var(--accent-color)";
    }

    // Pipeline: Nominatim -> AI Fallback
    (async () => {
        let locations = await searchLocationNominatim(dest);

        if (!locations || locations.length === 0) {
            if (status) status.innerText = "🤔 地圖未詳盡，轉由 AI 驗證中...";
            locations = await verifyLocationAI(dest, key);
        }

        if (!locations || locations.length === 0) {
            throw new Error("找不到此地點，請嘗試更精確的名稱");
        }

        // --- SELECTION LOGIC ---
        if (locations.length > 1) {
            if (status) status.innerText = `❓ 找到 ${locations.length} 個結果，請選擇...`;
            showLocationSelectionModal(locations, (selectedLoc) => {
                executeCustomRoutePlan(selectedLoc);
            });
            if (btn) btn.disabled = false; // Re-enable for retry/cancel
        } else {
            // Exact match
            executeCustomRoutePlan(locations[0]);
        }
    })().catch(e => {
        alert("錯誤: " + e.message);
        if (status) {
            status.innerText = "❌ " + e.message;
            status.style.color = "var(--danger-color)";
        }
        if (btn) btn.disabled = false;
    });
}

function showLocationSelectionModal(locations, onSelect) {
    const modal = document.getElementById('locationSelectModal');
    const list = document.getElementById('locationSelectList');
    if (!modal || !list) return;

    list.innerHTML = ''; // Clear prev

    locations.forEach(loc => {
        const item = document.createElement('div');
        item.style.padding = "10px";
        item.style.border = "1px solid #444";
        item.style.borderRadius = "4px";
        item.style.cursor = "pointer";
        item.style.background = "#222";
        item.onmouseover = () => item.style.background = "#333";
        item.onmouseout = () => item.style.background = "#222";

        item.innerHTML = `
            <div style="font-weight:bold; color:var(--accent-color);">${loc.formatted_name}</div>
            <div style="font-size:0.8em; color:#888;">${loc.lat}, ${loc.lng} (${loc.source === 'OSM/Nominatim' ? '地圖' : 'AI'})</div>
        `;
        item.onclick = () => {
            closeModal('locationSelectModal');
            onSelect(loc);
        };
        list.appendChild(item);
    });

    openModal('locationSelectModal');
}


async function executeCustomRoutePlan(location) {
    const btn = document.getElementById('sendBtnCustom');
    const status = document.getElementById('custom-status');

    if (btn) btn.disabled = true;

    // 2. Planning Route
    if (status) status.innerText = `✅ 已確認: ${location.formatted_name} (${location.source === 'OSM/Nominatim' ? '地圖' : 'AI'})... 規劃中`;

    // Construct Prompt
    const currentPos = await getGPS();
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

    let prompt = `現在時間 ${timeStr}。我的位置在 ${currentPos}。`;
    prompt += `\n我想前往：${location.formatted_name} (${location.lat}, ${location.lng})`;

    // --- NEW: Read Checkboxes ---
    const prefs = [];
    if (document.getElementById('prefTrain')?.checked) prefs.push('火車(Train)');
    if (document.getElementById('prefMRT')?.checked) prefs.push('捷運(MRT)');
    if (document.getElementById('prefBus')?.checked) prefs.push('公車(Bus)');
    if (document.getElementById('prefBike')?.checked) prefs.push('公共自行車(YouBike)');
    if (document.getElementById('prefWalk')?.checked) prefs.push('步行(Walk)');

    const prefStr = prefs.join('、') || "無特定偏好 (請綜合評估火車、捷運、公車、YouBike、步行，提供最佳路線)";
    prompt += `\n\n交通工具偏好: ${prefStr}`;

    // DO NOT include saved stations for Custom Route

    prompt += `\n請提供最佳交通建議。`;
    prompt += `\n請列出詳細轉乘步驟 (steps array, very important)。`;
    prompt += `\n同時請將經過的重要站點資訊分類填入 "stations" 物件中，用於顯示於下方的四大區塊。`;
    prompt += `\n回傳 JSON 格式: { 
            "itineraries": [{ 
                "title": "方案A", 
                "mode": "綜合", 
                "total_duration": "45分", 
                "steps": [{"type":"walk", "instruction":"..."}, {"type":"mrt", "instruction":"..."}] 
            }],
            "stations": {
                "train": [{"from":"台北", "to":"松山", "line":"區間快"}], 
                "mrt": [{"from":"大安森林公園", "to":"淡水", "line":"淡水信義線"}],
                "bus": [{"from":"A站", "to":"B站", "line":"307"}],
                "bike": [{"from":"租借站", "to":"還車站"}]
            }
        }`;

    // Set Target
    window.currentItineraryTarget = 'itinerary-result-custom';

    // Custom handling to parse additional "stations" data
    try {
        const apiRes = await callGeminiAPI(prompt, 'sendBtnCustom', '-3'); // Pass '-3' for Custom Tab
        if (apiRes && apiRes.stations) {
            // Render specialized blocks for Custom Tab
            // Explicitly pass '-3' suffix
            if (apiRes.stations.train) renderResult('train', apiRes.stations.train, '-3'); else renderResult('train', [], '-3');
            if (apiRes.stations.mrt) renderResult('mrt', apiRes.stations.mrt, '-3'); else renderResult('mrt', [], '-3');
            if (apiRes.stations.bus) renderResult('bus', apiRes.stations.bus, '-3'); else renderResult('bus', [], '-3');
            if (apiRes.stations.bike) renderResult('bike', apiRes.stations.bike, '-3'); else renderResult('bike', [], '-3');
        }
    } catch (e) {
        console.error("Custom Route Error:", e);
        if (status) status.innerText = "❌ 發生錯誤";
    }

    if (btn) btn.disabled = false;
    if (status) status.innerText = "";
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
    // Labels
    const l1 = document.createElement('label'); l1.innerText = "1. 選擇縣市"; l1.style.color = "#aaa"; l1.style.fontSize = "0.9em";
    const l2 = document.createElement('label'); l2.innerText = "2. 選擇區域"; l2.style.color = "#aaa"; l2.style.fontSize = "0.9em";
    const l3 = document.createElement('label'); l3.innerText = "3. 輸入站點關鍵字"; l3.style.color = "#aaa"; l3.style.fontSize = "0.9em";

    // New Search Input (Moved from header)
    const busInput = document.createElement('input');
    busInput.id = 'busStationSearchInput';
    busInput.type = 'text';
    busInput.placeholder = '例如: 中壢農會';
    busInput.style.width = "100%";
    busInput.style.padding = "8px";
    busInput.style.background = "#222";
    busInput.style.color = "#fff";
    busInput.style.border = "1px solid #444";
    busInput.style.borderRadius = "4px";

    // Action Button
    const searchBtn = document.createElement('button');
    searchBtn.innerText = "🔍 搜尋站點";
    searchBtn.id = 'busSearchBtn';
    searchBtn.className = 'btn-primary';
    searchBtn.disabled = true; // Default disabled
    searchBtn.style.opacity = "0.5";
    searchBtn.style.marginTop = "10px";

    // Input Handler to enable/disable button
    busInput.oninput = () => {
        if (busInput.value.trim().length > 0) {
            searchBtn.disabled = false;
            searchBtn.style.opacity = "1";
        } else {
            searchBtn.disabled = true;
            searchBtn.style.opacity = "0.5";
        }
    };

    searchBtn.onclick = () => {
        const city = document.getElementById('busCitySelect').value;
        const dist = document.getElementById('busDistrictSelect').value;
        const kw = busInput.value.trim();

        if (!kw) return;

        const fullQuery = `${city} ${dist} ${kw} 公車站`;
        askGeminiForStations(fullQuery, 'bus');
    };

    container.appendChild(l1);
    container.appendChild(citySelect);
    container.appendChild(l2);
    container.appendChild(distSelect);
    container.appendChild(l3);
    container.appendChild(busInput);
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

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    checkKeyStatus();
    renderAllStations();

    // Tab Event Listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.id.replace('tabBtn', '').toLowerCase();
            switchSettingsTab(tabName);
        });
    });

    // Auto-fetch YouBike data if user has bike stations
    if (state.bike.length > 0) {
        // Find center of first station or default?
        // Actually fetchYouBikeData handles fetching all stations in known areas if needed, or we just force refresh current view?
        // The implementation in api_service handles fetching based on current map center or default.
        // For dashboard list update, we just need the data.
        // Let's assume user is in Taipei/New Taipei/Taoyuan for now or use the first station's coordinates?
        // Actually askGeminiForStations might have been better but we just want status.
        // Let's simplified: just fetch default area or nothing.
        // Wait, the previous implementation of fetchYouBikeData uses lat/lng.
        // If we don't have a map center, what do we do?
        // We can just try to fetch if we have saved stations.

        // Just trigger a fetch around a default point or the first saved station
        if (state.bike[0] && state.bike[0].lat) {
            const s = state.bike[0];
            fetchYouBikeData(s.lat, s.lng, true);
        } else {
            fetchYouBikeData(25.0330, 121.5654, true); // Default Taipei 101
        }
    }
});
