// api_service.js
// Handles all external API calls and AI interactions

// --- YOUBIKE API ---
let youbikeCache = [];

const YOUBIKE_AREA_MAP = {
    "01": "臺北市", "02": "新北市", "03": "桃園市",
    "04": "新竹市", "05": "新竹縣", "06": "臺中市",
    "07": "苗栗縣", "08": "嘉義市", "09": "嘉義縣",
    "10": "臺南市", "11": "高雄市", "12": "屏東縣"
};

// Global Map for Real-time Data (Name -> Info)
window.youBikeRealTimeMap = {};

async function fetchYouBikeData(force = false) {
    if (!force && youbikeCache.length > 0) return youbikeCache;

    console.log("Fetching YouBike Data...");
    const stations = [];
    window.youBikeRealTimeMap = {}; // Reset map

    try {
        // Unified API for all regions (Real-time data: station-yb2.json)
        const res = await fetch('https://apis.youbike.com.tw/json/station-yb2.json');
        const data = await res.json();

        // Reset STATION_DATA['bike'] to empty object to populate hierarchies
        // Note: STATION_DATA is global, we need to be careful.
        if (typeof STATION_DATA !== 'undefined') {
            STATION_DATA['bike'] = {};
        }

        data.forEach(s => {
            // Filter invalid coordinates
            if (!s.lat || !s.lng) return;

            const areaCode = s.area_code_2;
            const city = YOUBIKE_AREA_MAP[areaCode] || "其他地區";
            const district = s.district_tw || "其他區";
            const name = s.name_tw.replace(/YouBike2\.0_|YouBike 2\.0_/gi, '');

            // Real-time Info
            const info = {
                rent: s.available_spaces,
                return: s.empty_spaces,
                updated: s.updated_at
            };
            window.youBikeRealTimeMap[name] = info;

            // 1. Structure for Modal (City -> District -> Stations)
            if (typeof STATION_DATA !== 'undefined') {
                if (!STATION_DATA['bike'][city]) STATION_DATA['bike'][city] = {};
                if (!STATION_DATA['bike'][city][district]) STATION_DATA['bike'][city][district] = [];

                const stationObj = { name: name, lat: s.lat, lng: s.lng, region: city, ...info };
                STATION_DATA['bike'][city][district].push(stationObj);
            }

            // 2. Flat list for AI Search
            stations.push({ name: name, lat: s.lat, lng: s.lng, region: city, ...info });
        });

        console.log("YouBike Data Loaded");

    } catch (e) {
        console.error("YouBike API Error:", e);
    }

    youbikeCache = stations;
    console.log(`Loaded ${stations.length} YouBike stations.`);
    return stations;
}

// --- HOLIDAY API ---
async function checkIsHoliday(dateObject) {
    const year = dateObject.getFullYear();
    const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObject.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    try {
        // Try fetching from CDN
        const res = await fetch(`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`);
        if (!res.ok) throw new Error("Calendar API error");

        const data = await res.json();
        const todayData = data.find(d => d.date === dateStr);

        if (todayData) {
            return todayData.isHoliday;
        }
    } catch (e) {
        console.warn("Holiday check failed, fallback to weekend check", e);
    }

    // Fallback: Weekend check
    const dayOfWeek = dateObject.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
}

// --- HELPER: DISTANCE ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// --- GEMINI AI ---

async function createCommutePrompt(modeOverride = null) {
    const now = new Date();
    // Use passed mode or recalculate (requires script.js to be loaded for getCommuteMode)
    // If script.js isn't loaded yet (unlikely), fallback to old logic? 
    // We assume script.js is loaded.
    const mode = modeOverride || (typeof getCommuteMode === 'function' ? getCommuteMode() : 'home');

    const isHoliday = await checkIsHoliday(now);
    const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
    const pos = await getGPS();

    // Helper to format stations
    const fmtStations = (list) => list.map(s => `${s.name || s}${s.lat ? `(${s.lat},${s.lng})` : ''}`).join('、');

    let prompt = `現在時間是 ${timeStr}。`;
    prompt += ` 我的位置在 ${pos}。`;

    if (mode === 'late_night') {
        prompt += `\n現在是深夜時段 (Late Night)。公共交通只剩下 Ubike。`;
        prompt += `\n請僅查詢 YouBike 路線。忽略火車、捷運和公車。`;

        // Force limited context
        if (state.train.length) prompt += `\n(已忽略火車站)`;
        if (state.mrt.length) prompt += `\n(已忽略捷運站)`;
        if (state.bus.length) prompt += `\n(已忽略公車站)`;
        if (state.bike.length) prompt += `\nYouBike: ${fmtStations(state.bike)}`;

        prompt += `\n請提供附近的 YouBike 站點與騎乘建議。`;

    } else if (mode === 'old_home') {
        // --- Special Mode: Back to Old Home ---
        prompt += ` 我準備回老家。`;
        const s = state.settings.holiday || {}; // Fallback if missing
        const dest = s.oldHomeLastMile || { name: "未設定", trans: [] };
        const trans = s.oldHomeTrans || s.homeTrans || []; // Fallback to home trans

        prompt += `\n回老家設定: 目的地 ${dest.name} (${dest.trans.join('+')})`;
        if (dest.coords) {
            prompt += ` (座標: ${dest.coords.lat}, ${dest.coords.lng})`;
        }
        prompt += `\n啟用交通工具: ${trans.join(', ')}`;

        // Smart Origin Logic: Check if near Work or Home Last Mile
        if (state.settings.workLastMile && state.settings.workLastMile.coords && pos !== "無GPS" && pos !== "GPS失敗") {
            const [myLat, myLng] = pos.split(',').map(Number);
            const dist = calculateDistance(myLat, myLng, state.settings.workLastMile.coords.lat, state.settings.workLastMile.coords.lng);
            if (dist !== null && dist < 2.0) { // < 2km
                prompt += `\n\n[系統提示] 偵測到您目前靠近上班地點 (${state.settings.workLastMile.name}, 距離 ${dist.toFixed(1)}km)。`;
                prompt += `\n建議行程起點: 請直接規劃從「${state.settings.workLastMile.name}」出發前往老家。`;
            }
        }
        if (state.settings.homeLastMile && state.settings.homeLastMile.coords && pos !== "無GPS" && pos !== "GPS失敗") {
            const [myLat, myLng] = pos.split(',').map(Number);
            const dist = calculateDistance(myLat, myLng, state.settings.homeLastMile.coords.lat, state.settings.homeLastMile.coords.lng);
            if (dist !== null && dist < 2.0) { // < 2km
                prompt += `\n\n[系統提示] 偵測到您目前靠近住家 (${state.settings.homeLastMile.name}, 距離 ${dist.toFixed(1)}km)。`;
                prompt += `\n建議行程起點: 請直接規劃從「${state.settings.homeLastMile.name}」出發前往老家。`;
            }
        }

        prompt += `\n\n已儲存的常用站點：`;
        if (state.train.length) prompt += `\n火車: ${fmtStations(state.train)}`;
        if (state.mrt.length) prompt += `\n捷運: ${fmtStations(state.mrt)}`;
        if (state.bus.length) prompt += `\n公車: ${fmtStations(state.bus)}`;
        if (state.bike.length) prompt += `\nYouBike: ${fmtStations(state.bike)}`;

    } else if (mode === 'custom') {
        // We might handle custom route logic outside in handleCustomRoute, 
        // but if it calls this, we should support it?
        // Actually handleCustomRoute builds its own prompt usually?
        // Let's check script.js handleCustomRoute... IT DOES NOT.
        // Wait, handleCustomRoute logic in script.js (I haven't seen it fully).
        // If handleSend('custom') is called, it might use this.
        // But usually 'Where to?' has an input box.
    } else if (isHoliday) {
        prompt += ` 今日是假日。`;
        // ... (Keep existing Holiday logic but maybe refine it?)
        // If mode is NOT old_home (e.g. just opening the app on a holiday),
        // it defaults to "Home" logic usually unless specified?
        // The existing logic prints "Holiday settings" generally.
        // Let's keep it for general holiday context.
        const holidaySettings = state.settings.holiday || {};
        const oldHome = holidaySettings.oldHomeLastMile;
        const home = holidaySettings.homeLastMile;

        prompt += `\n我的假日交通設定：`;
        if (oldHome && oldHome.name) prompt += `\n- 預設目的地一 (老家): ${oldHome.name}`;
        if (home && home.name) prompt += `\n- 預設目的地二 (住家): ${home.name}`;

        // Add all stations
        prompt += `\n\n已儲存的常用站點：`;
        if (state.train.length) prompt += `\n火車: ${fmtStations(state.train)}`;
        if (state.mrt.length) prompt += `\n捷運: ${fmtStations(state.mrt)}`;
        if (state.bus.length) prompt += `\n公車: ${fmtStations(state.bus)}`;
        if (state.bike.length) prompt += `\nYouBike: ${fmtStations(state.bike)}`;

    } else {
        // Work or Home (Default)
        prompt += ` 今日是平日。`;

        let targetSettings = {};
        if (mode === 'work') {
            prompt += ` 我準備去上班。`;
            const s = state.settings;
            prompt += `\n上班設定: 時間 ${s.workTime}, 目的地 ${s.workLastMile.name} (${s.workLastMile.trans.join('+')})`;
            prompt += `\n啟用交通工具: ${s.workTrans.join(', ')}`;
        } else {
            prompt += ` 我準備下班/回家。`;
            const s = state.settings;
            // Default to Home logic
            prompt += `\n下班/回家設定: 時間 ${s.homeTime}, 目的地 ${s.homeLastMile.name} (${s.homeLastMile.trans.join('+')})`;
            prompt += `\n啟用交通工具: ${s.homeTrans.join(', ')}`;
        }

        prompt += `\n\n已儲存的常用站點：`;
        if (state.train.length) prompt += `\n火車: ${fmtStations(state.train)}`;
        if (state.mrt.length) prompt += `\n捷運: ${fmtStations(state.mrt)}`;
        if (state.bus.length) prompt += `\n公車: ${fmtStations(state.bus)}`;
        if (state.bike.length) prompt += `\nYouBike: ${fmtStations(state.bike)}`;
    }

    prompt += `\n\n請根據現在時間與我的位置，提供最佳交通建議。`;
    if (mode !== 'late_night') {
        prompt += `\n請列出建議的交通方案，包含火車/捷運/公車/YouBike的時刻與路線。`;
        prompt += `\n針對火車/捷運/公車/YouBike 的個別結果區塊，請不要只列出附近站點，而是要列出「該方案中使用的完整路段資訊」。`;
        prompt += `\n格式要求: { "from": "上車站名", "to": "下車站名", "line": "路線/車種 (如 112南、區間車)", "lat_from": 上車站緯度, "lng_from": 上車站經度, "lat_to": 下車站緯度, "lng_to": 下車站經度 }`;
    }
    prompt += `\n回傳 JSON 格式: { 
        "train": [{"from": "松山", "to": "中壢", "line": "自強號", "lat_from": ..., "lng_from": ..., "lat_to": ..., "lng_to": ...}], 
        "mrt": [], 
        "bus": [{"from": "中壢公車站", "to": "中山東路口", "line": "112南、169"}], 
        "bike": [], 
        "itineraries": [{ "title": "方案A", "details": "...", "time": "30分" }] 
    }`;

    return prompt;
}

async function callGeminiAPI(prompt, btnId = 'sendBtn', renderSuffix = '') {
    const key = state.settings.apiKey;
    if (!key) return alert("請先設定 API Key");

    const btn = document.getElementById(btnId);
    let originalText = "";
    if (btn) {
        originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "🤖 規劃路線方案中...";
    }

    // Debug Capture (Prompt)
    window.lastDebugData = { prompt: prompt, response: "Thinking..." };

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();

        // Debug Capture (Response Raw)
        if (data) {
            window.lastDebugData.response = data;
        }

        // Handle errors (e.g., 503 Overloaded)
        if (data.error) {
            if (data.error.code === 503 || data.error.status === 'UNAVAILABLE' || (data.error.message && data.error.message.includes('overloaded'))) {
                throw new Error("AI現正忙碌中，請稍後再試一次");
            }
            throw new Error(data.error.message || "Unknown API Error");
        }

        const text = data.candidates[0].content.parts[0].text;



        // Extract JSON from potential Markdown or text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("無效的 JSON 格式 response");
        const json = JSON.parse(jsonMatch[0]);

        // REFRESH YouBike Data if results contain bike info
        // This ensures the dashboard displays the latest availability
        if (json.bike && json.bike.length > 0) {
            await fetchYouBikeData(true); // Force refresh
        }

        // Render Results (Core logic function, assumed to be global or passed)
        if (typeof renderResult === 'function') {
            // Handle potential nesting under 'stations' (AI inconsistency)
            const src = (json.stations && (json.stations.train || json.stations.mrt || json.stations.bus || json.stations.bike)) ? json.stations : json;

            renderResult('train', src.train, renderSuffix);
            renderResult('mrt', src.mrt, renderSuffix);
            renderResult('bus', src.bus, renderSuffix);
            renderResult('bike', src.bike, renderSuffix);
        }
        if (typeof renderItineraries === 'function') {
            renderItineraries(json.itineraries);
        }

        return json; // Return for further processing (e.g. Custom Route stations)


    } catch (e) {
        if (e.message.includes("AI現正忙碌中")) {
            alert(e.message);
        } else {
            alert("錯誤: " + e.message);
        }
        if (typeof window.openDebugModal === 'function') {
            window.openDebugModal();
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText || "📍 查詢"; // Fallback
        }
    }
}

// --- STATION SEARCH (AI) ---
async function askGeminiForStations(query, type = 'bike') {
    const grid = document.getElementById('modalGrid');

    // Debug Hook
    if (window.lastDebugData) { // Reset queryType
        window.lastDebugData.queryType = (type === 'bus' || type === 'bike') ? 'search' : 'gemini'; // search for manual calls
        // But wait, bus/bike AI search IS a gemini call, just a different purpose.
        // User asked: "If non-gemini-flash search" -> i.e. local filter?
        // No, User said: "If non-gemini-2.5-flash search (assumption: meaning official API or keyword?)".
        // Actually user said: "if non-gemini-2.5-flash search" -> "Sent Query".
        // Let's assume ANY search that isn't the main commute prompt.
        // For now, let's just log the QUERY as the prompt for these searches.
    }

    // Capture Query for Debug
    if (typeof window.lastDebugData !== 'undefined') {
        window.lastDebugData.queryType = 'search'; // Indicate this is a search query
        window.lastDebugData.prompt = `Search Query: ${query}\nType: ${type}`;
        window.lastDebugData.response = "Processing...";
    }

    // --- CASE 1: Bus Search (Direct AI) ---
    if (type === 'bus') {
        if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--accent-color);">
            🤖 AI 搜尋公車中...<br>
            <span style="font-size:0.8em; color:#888;">"${query}"</span>
        </div>`;

        // Bus Prompt
        const key = state.settings.apiKey;
        if (!key) {
            if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--danger-color);">❌ 未設定 API Key 無法使用 AI 搜尋</div>`;
            return;
        }

        const prompt = `請查詢台灣公車站點「${query}」的精確位置。
請確認該站點是否存在。
請回傳 JSON 格式：{"valid": true, "name": "完整站點名稱", "lat": 25.123, "lng": 121.123}
若找不到，請回傳 {"valid": false, "error": "找不到此站點"}`;

        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();

            // Debug Capture
            if (window.lastDebugData) window.lastDebugData.response = data;

            // Handle errors
            if (data.error) {
                if (data.error.code === 503 || data.error.status === 'UNAVAILABLE' || (data.error.message && data.error.message.includes('overloaded'))) {
                    throw new Error("AI現正忙碌中，請稍後再試一次");
                }
                throw new Error(data.error.message || "API Error");
            }

            const text = data.candidates[0].content.parts[0].text;
            const busJsonMatch = text.match(/\{[\s\S]*\}/);
            const json = busJsonMatch ? JSON.parse(busJsonMatch[0]) : { valid: false, error: "無法解析 AI 回應" };

            if (!json.valid) {
                if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--danger-color);">❌ AI 找不到: ${json.error || '未知原因'}</div>`;
            } else {
                toggleStation({ name: json.name, lat: json.lat, lng: json.lng });
                // Don't clear search for Bus UI? Or do? Bus UI uses dropdowns.
                // renderBusSearchUI doesn't use modalSearch for value storage but it reads it.
                // Let's alert.
                alert(`✅ AI 已新增公車: ${json.name}`);
                renderGrid(state['bus']); // Refresh Added list
            }
        } catch (e) {
            if (grid) {
                const msg = e.message.includes("AI現正忙碌中") ? e.message : `錯誤: ${e.message}`;
                grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--danger-color);">❌ ${msg}</div>`;
            }
        }
        return;
    }

    // --- CASE 2: YouBike Search (Official API -> AI) ---
    // STEP 1: Official API Search
    try {
        const stations = await fetchYouBikeData(); // Ensures data is loaded/cached
        const q = query.trim();
        const terms = q.split(' ').filter(t => t.trim().length > 0);

        // Score Helper
        const getScore = (stationName) => {
            const name = stationName.toLowerCase();
            if (terms.every(t => name.includes(t.toLowerCase()))) return 1.0;
            const queryChars = q.replace(/\s/g, '').toLowerCase().split('');
            let matchCount = 0;
            queryChars.forEach(char => {
                if (name.includes(char)) matchCount++;
            });
            return matchCount / queryChars.length;
        };

        const matches = stations
            .map(s => ({ ...s, score: getScore(s.name) }))
            .filter(s => s.score > 0.6)
            .sort((a, b) => b.score - a.score);

        if (matches.length > 0) {
            // Debug Capture for Official Search (Local)
            if (window.lastDebugData) window.lastDebugData.response = matches.slice(0, 20); // Capture top results for debug

            if (grid) grid.innerHTML = '';
            matches.slice(0, 10).forEach(m => {
                const div = document.createElement('div');
                div.className = 'grid-item';
                div.style.borderColor = 'var(--success-color)';
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;
                div.innerHTML = `🚲 ${m.name} <a href="${mapUrl}" target="_blank" onclick="event.stopPropagation()" style="text-decoration:none;">🗺️</a><br><span style="font-size:0.7em;color:#666">${m.region} (官方)</span>`;
                div.onclick = () => {
                    toggleStation(m);
                    document.getElementById('modalSearch').value = '';
                    selectCategory('ADDED');
                    alert(`✅ 已新增官方站點: ${m.name}`);
                };
                if (grid) grid.appendChild(div);
            });

            if (matches.length > 10) {
                const more = document.createElement('div');
                more.style.gridColumn = '1/-1';
                more.style.textAlign = 'center';
                more.style.color = '#888';
                more.innerText = `(還有 ${matches.length - 10} 筆結果，請輸入更精確的關鍵字)`;
                if (grid) grid.appendChild(more);
            }
            return;
        }

    } catch (e) {
        console.error("Official Search Failed", e);
    }

    // --- STEP 2: AI Fallback (YouBike) ---
    const key = state.settings.apiKey;
    if (!key) {
        if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--danger-color);">❌ 官方資料庫找不到，且未設定 API Key 無法使用 AI 搜尋</div>`;
        return;
    }

    if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--accent-color);">
        🤖 官方資料庫無結果，轉由 AI 搜尋...<br>
        <span style="font-size:0.8em; color:#888;">"${query}"</span>
    </div>`;

    const prompt = `請幫我查詢台灣 YouBike 站點「${query}」的精確經緯度。
請務必確認該站點是否存在。
請回傳 JSON 格式：{"valid": true, "name": "官方精確站名", "lat": 25.123, "lng": 121.123}
若找不到或不確定，請回傳 {"valid": false, "error": "找不到此站點"}`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();

        // Debug Capture
        if (window.lastDebugData) window.lastDebugData.response = data;

        // Handle errors
        if (data.error) {
            if (data.error.code === 503 || data.error.status === 'UNAVAILABLE' || (data.error.message && data.error.message.includes('overloaded'))) {
                throw new Error("AI現正忙碌中，請稍後再試一次");
            }
            throw new Error(data.error.message || "API Error");
        }

        const text = data.candidates[0].content.parts[0].text;
        const bikeJsonMatch = text.match(/\{[\s\S]*\}/);
        const json = bikeJsonMatch ? JSON.parse(bikeJsonMatch[0]) : { valid: false, error: "無法解析 AI 回應" };

        if (!json.valid) {
            if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--danger-color);">❌ AI 也找不到: ${json.error || '未知原因'}</div>`;
        } else {
            // Success
            toggleStation({ name: json.name, lat: json.lat, lng: json.lng });
            document.getElementById('modalSearch').value = '';
            selectCategory('ADDED');
            alert(`✅ AI 已新增: ${json.name} (注意: AI 資料可能不完全準確)`);
        }
    } catch (e) {
        const msg = e.message.includes("AI現正忙碌中") ? e.message : `發生錯誤: ${e.message}`;
        if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--danger-color);">❌ ${msg}</div>`;
    }
}
