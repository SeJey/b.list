const TVDB_API_KEY = "b1feca17-dc79-4438-80f8-f01d1b26b767";
const TVDB_BASE_URL = "https://api4.thetvdb.com/v4";
const IMAGE_BASE_URL = "https://artworks.thetvdb.com/banners";

let tvdbToken = null;
let tokenExpiryTime = null;

/**
 * Authenticate with TVDB v4 and get JWT token
 */
async function authenticateTVDB() {
  try {
    const response = await fetch(`${TVDB_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: TVDB_API_KEY })
    });
    if (!response.ok) throw new Error(`TVDB auth failed: ${response.status}`);
    const data = await response.json();
    tvdbToken = data.data.token;
    // Token is valid for 24 hours, refresh after 23 hours
    tokenExpiryTime = Date.now() + (23 * 60 * 60 * 1000);
    return tvdbToken;
  } catch (err) {
    console.error('TVDB authentication failed:', err);
    throw err;
  }
}

/**
 * Ensure we have a valid JWT token
 */
async function ensureTVDBToken() {
  if (!tvdbToken || !tokenExpiryTime || Date.now() >= tokenExpiryTime) {
    await authenticateTVDB();
  }
  return tvdbToken;
}

/**
 * Fetch from TVDB v4 API with automatic token management
 */
async function fetchTVDB(endpoint, params = '') {
  const token = await ensureTVDBToken();
  const url = params
    ? `${TVDB_BASE_URL}${endpoint}?${params}`
    : `${TVDB_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, re-authenticate
      tvdbToken = null;
      tokenExpiryTime = null;
      return fetchTVDB(endpoint, params);
    }
    const errorText = await response.text();
    console.error('TVDB API error:', response.status, errorText);
    throw new Error(`TVDB API error: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Search for TV series on TVDB
 */
async function searchTVSeries(query) {
  try {
    const result = await fetchTVDB('/search', `query=${encodeURIComponent(query)}&type=series`);
    return result.data || [];
  } catch (err) {
    console.error('TVDB search failed:', err);
    return [];
  }
}

/**
 * Get series details including seasons
 */
async function getSeriesDetails(seriesId) {
  try {
    // Try the extended endpoint which includes translations and seasons
    let result;
    try {
      result = await fetchTVDB(`/series/${seriesId}/extended`, 'meta=translations');
    } catch (extErr) {
      result = await fetchTVDB(`/series/${seriesId}`);
    }
    
    return result.data || result || null;
  } catch (err) {
    console.error('Failed to fetch series details:', err);
    return null;
  }
}

/**
 * Get series translation record for a language (e.g., eng)
 */
async function getSeriesTranslation(seriesId, language = 'eng') {
  try {
    const result = await fetchTVDB(`/series/${seriesId}/translations/${language}`);
    return result?.data || null;
  } catch (err) {
    console.error('Failed to fetch series translation:', err);
    return null;
  }
}

/**
 * Get episode count for a series season (default season type)
 */
async function getSeriesSeasonEpisodeCount(seriesId, seasonType = 'default', seasonNumber = 1) {
  try {
    const params = `page=0&season=${encodeURIComponent(seasonNumber)}`;
    const result = await fetchTVDB(`/series/${seriesId}/episodes/${seasonType}`, params);
    const episodes = result?.data?.episodes || [];
    const total = result?.links?.total_items;
    return typeof total === 'number' ? total : episodes.length;
  } catch (err) {
    console.error('Failed to fetch series episodes:', err);
    return null;
  }
}

/**
 * Get season details (extended) by season ID
 */
async function getSeasonDetails(seasonId) {
  try {
    const result = await fetchTVDB(`/seasons/${seasonId}/extended`);
    return result?.data || null;
  } catch (err) {
    console.error('Failed to fetch season details:', err);
    return null;
  }
}

/**
 * Get episode details (extended) by episode ID
 */
async function getEpisodeDetails(episodeId) {
  try {
    const result = await fetchTVDB(`/episodes/${episodeId}/extended`);
    return result?.data || null;
  } catch (err) {
    console.error('Failed to fetch episode details:', err);
    return null;
  }
}

export { fetchTVDB, searchTVSeries, getSeriesDetails, getSeriesTranslation, getSeriesSeasonEpisodeCount, getSeasonDetails, getEpisodeDetails, IMAGE_BASE_URL };