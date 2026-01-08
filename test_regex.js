const getMapLinkHtml = (name, lat, lng, text) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const content = (text || name || '').trim();
    // Simulating the actual function output (simplified for logging)
    return `<a href="${url}">${content}</a>`;
};

const processText = (html) => {
    // Simulate previous formatting steps

    // FIX: Only replace "digits + dot + space" to avoid breaking coordinates like 25.04
    html = html.replace(/(\d+\.\s)/g, '<br>$1');
    html = html.replace(/\*\*(.*?)\*\*/g, '<span style="color:var(--accent-color); font-weight:bold;">$1</span>');

    console.log(`[DEBUG] HTML after formatting: ${html}`);

    // Refined Regex:
    return html.replace(/([^\:：，,。;；<>\n]+)\s*\(\s*(\d+\.\d+)\s*,\s*(\d+\.\d+)\s*\)/g, (match, text, lat, lng) => {
        let cleanText = text.trim();
        let preText = "";
        let prefix = "";

        // Cleanup leading punctuation
        cleanText = cleanText.replace(/^[:：,，\.\s]+/, '');

        // Common prepositions to split out of the link
        // We want the LAST occurrence to split "Walk 3 mins TO Station"
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
            // Split into: PreText + Prep + LinkText
            // "Walk to " + "Station" -> "Walk " + "to" + "Station"
            preText = cleanText.substring(0, lastPrepIndex);
            prefix = matchedPrep;
            cleanText = cleanText.substring(lastPrepIndex + matchedPrep.length).trim();
        }

        return `${preText}[PREFIX:${prefix}] [LINK:${cleanText}] (Coords:${lat},${lng})`;
    });
};

const examples = [
    "1. **步行**: 從目前位置 (25.0610, 121.5332) 步行約 10 分鐘",
    "2. **捷運**: ...至捷運台北小巨蛋站 (25.052, 121.55)。建議約 17:45 出發。",
    "5. **YouBike**: 從中壢火車站步行約 3 分鐘至 YouBike 中壢火車站(前站)中和路租借站 (24.95404, 121.22644)，租借 YouBike"
];

examples.forEach(ex => {
    console.log(`Original: ${ex}`);
    console.log(`Processed: ${processText(ex)}\n`);
});
