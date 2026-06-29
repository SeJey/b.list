function getGeminiProxyUrl(settings) {
    return settings.geminiProxyUrl || window.__gemini_proxy_url;
}

async function callGeminiApi(payload, settings = {}, retries = 3, delay = 1000) {
    const proxyUrl = getGeminiProxyUrl(settings);
    if (!proxyUrl) {
        throw new Error('AI proxy URL not configured. Set window.__gemini_proxy_url in config.local.js or route AI calls through your server.');
    }

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload })
            });
            if (!res.ok) throw new Error(`AI proxy error: ${res.status}`);
            return await res.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
        }
    }
}

export { callGeminiApi };
