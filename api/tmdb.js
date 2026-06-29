// TMDb API Key: Do not commit to version control.
// Inject via window.__tmdb_api_key or use a server-side proxy.
const TMDb_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function getTMDbApiKey() {
  if (typeof window.__tmdb_api_key !== 'undefined' && window.__tmdb_api_key) {
    return window.__tmdb_api_key;
  }

  try {
    const settings = JSON.parse(localStorage.getItem('blist-settings') || '{}');
    if (settings.tmdbKey) return settings.tmdbKey;
  } catch (error) {
    console.warn('Could not read TMDb API key from local settings:', error);
  }

  throw new Error('TMDb API key not configured. Set window.__tmdb_api_key in config.local.js before loading main.js.');
}

async function fetchTMDb(endpoint, params = '') {
    const TMDb_API_KEY = getTMDbApiKey();
    // Build URL safely — only append params when provided to avoid trailing ampersands
    const url = `${TMDb_BASE_URL}${endpoint}?api_key=${TMDb_API_KEY}` + (params ? `&${params}` : '');

    let response;
    try {
        response = await fetch(url);
    } catch (networkErr) {
        throw new Error(`Network error contacting TMDb: ${networkErr.message}`);
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`TMDb API error: ${response.status}${body ? ' - ' + body : ''}`);
    }

    return await response.json();
}

export { fetchTMDb, IMAGE_BASE_URL };
