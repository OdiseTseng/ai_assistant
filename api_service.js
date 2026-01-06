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

async function fetchYouBikeData() {
    if (youbikeCache.length > 0) return youbikeCache;

    console.log("Fetching YouBike Data...");
    const stations = [];

    try {
        // Unified API for all regions
        const res = await fetch('https://apis.youbike.com.tw/json/station-min-yb2.json');
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
            const name = s.name_tw.replace('YouBike2.0_', '');

            // 1. Structure for Modal (City -> District -> Stations)
            if (typeof STATION_DATA !== 'undefined') {
                if (!STATION_DATA['bike'][city]) STATION_DATA['bike'][city] = {};
                if (!STATION_DATA['bike'][city][district]) STATION_DATA['bike'][city][district] = [];

                const stationObj = { name: name, lat: s.lat, lng: s.lng, region: city };
                STATION_DATA['bike'][city][district].push(stationObj);
            }

            // 2. Flat list for AI Search
            stations.push({ name: name, lat: s.lat, lng: s.lng, region: city });
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

// --- GEMINI AI ---

async function createCommutePrompt() {
    const now = new Date();
    const isHoliday = await checkIsHoliday(now);
    const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

    let prompt = `現在時間是 ${timeStr}。`;

    // Get GPS
    const pos = await getGPS();
    prompt += ` 我的位置在 ${pos}。`;

    // Helper to format stations
    const fmtStations = (list) => list.map(s => `${s.name || s}${s.lat ? `(${s.lat},${s.lng})` : ''}`).join('、');

    if (isHoliday) {
        prompt += ` 今日是假日。`;
        const holidaySettings = state.settings.holiday || {};
        const oldHome = holidaySettings.oldHomeLastMile;
        const home = holidaySettings.homeLastMile;

        prompt += `\n我的假日交通設定：`;
        if (oldHome && oldHome.name) prompt += `\n- 預設目的地一 (老家): ${oldHome.name}`;
        if (home && home.name) prompt += `\n- 預設目的地二 (住家): ${home.name}`;

    } else {
        prompt += ` 今日是平日。`;
        const work = state.settings.workLastMile;
        const home = state.settings.homeLastMile;
        const workTime = state.settings.workTime;
        const homeTime = state.settings.homeTime;

        prompt += `\n我的平日通勤設定：`;
        prompt += `\n- 上班時間 ${workTime}，最後一哩路前往 ${work.name} (${work.trans.join('+')})`;
        prompt += `\n- 下班時間 ${homeTime}，最後一哩路前往 ${home.name} (${home.trans.join('+')})`;
    }

    prompt += `\n\n已儲存的常用站點：`;
    if (state.train.length) prompt += `\n火車: ${fmtStations(state.train)}`;
    if (state.mrt.length) prompt += `\n捷運: ${fmtStations(state.mrt)}`;
    if (state.bus.length) prompt += `\n公車: ${fmtStations(state.bus)}`;
    if (state.bike.length) prompt += `\nYouBike: ${fmtStations(state.bike)}`;

    prompt += `\n\n請根據現在時間與我的位置，判斷我應該是「上班中」、「下班中」還是「假日出遊」。`;
    prompt += `\n如果不確定，請提供前往上述設定目的地的交通建議。`;
    prompt += `\n請列出建議的交通方案，包含火車/捷運/公車/YouBike的時刻與路線。`;
    prompt += `\n回傳 JSON 格式: { "train": [], "mrt": [], "bus": [], "bike": [], "itineraries": [{ "title": "方案A", "details": "...", "time": "30分" }] }`;

    return prompt;
}

async function callGeminiAPI(prompt) {
    const key = state.settings.apiKey;
    if (!key) return alert("請先設定 API Key");

    const btn = document.getElementById('sendBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "🤖 思考中...";
    }

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data.candidates[0].content.parts[0].text;

        const debugArea = document.getElementById('debugArea');
        if (debugArea) debugArea.style.display = 'none';

        const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, ''));

        // Render Results (Core logic function, assumed to be global or passed)
        if (typeof renderResult === 'function') {
            renderResult('train', json.train);
            renderResult('mrt', json.mrt);
            renderResult('bus', json.bus);
            renderResult('bike', json.bike);
        }
        if (typeof renderItineraries === 'function') {
            renderItineraries(json.itineraries);
        }

    } catch (e) {
        alert("錯誤: " + e.message);
        const debugArea = document.getElementById('debugArea');
        const responseArea = document.getElementById('responseArea');
        if (debugArea) debugArea.style.display = 'block';
        if (responseArea) responseArea.innerText = "API Error: " + e.message;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📍 根據設定取得 GPS 並查詢";
        }
    }
}

async function askGeminiForStations(query) {
    const grid = document.getElementById('modalGrid');

    // --- STEP 1: Official API Search ---
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
            if (grid) grid.innerHTML = '';
            matches.slice(0, 10).forEach(m => {
                const div = document.createElement('div');
                div.className = 'grid-item';
                div.style.borderColor = 'var(--success-color)';
                div.innerHTML = `🚲 ${m.name}<br><span style="font-size:0.7em;color:#666">${m.region} (官方)</span>`;
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

    // --- STEP 2: AI Fallback ---
    const key = state.settings.apiKey;
    if (!key) {
        if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--danger-color);">❌ 官方資料庫找不到，且未設定 API Key 無法使用 AI 搜尋</div>`;
        return;
    }

    if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--accent-color);">
        🤖 官方資料庫無結果，轉由 AI 搜尋...<br>
        <span style="font-size:0.8em; color:#888;">"${query}"</span>
    </div>`;

    const prompt = `請幫我查詢台灣地點「${query}」的精確經緯度。
請務必確認該地點是否存在，若為連鎖店請確認該分店是否存在。
請回傳 JSON 格式：{"valid": true, "name": "官方或更精確名稱", "lat": 25.123, "lng": 121.123}
若找不到或不確定，請回傳 {"valid": false, "error": "找不到此地點"}`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data.candidates[0].content.parts[0].text;
        const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, ''));

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
        if (grid) grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--danger-color);">❌發生錯誤: ${e.message}</div>`;
    }
}
