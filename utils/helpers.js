/**
 * Helper utilities extracted from main.js
 * Contains reusable functions for user, progress, and display calculations
 */

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(value = '') {
  return escapeHtml(value);
}

export function normalizeStoredRating(rating) {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating <= 0) return null;
  const score = numericRating <= 10 ? numericRating * 10 : numericRating;
  return Math.max(1, Math.min(100, Math.round(score)));
}

export function normalizeRatingForStorage(rating, ratingSystem = '1-10') {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating <= 0) return null;
  const max = ratingSystem === '1-100' ? 100 : 10;
  const clamped = Math.max(1, Math.min(max, numericRating));
  return ratingSystem === '1-100'
    ? Math.round(clamped)
    : Math.round(clamped * 10);
}

export function formatStoredRating(rating, settings = {}) {
  const normalizedRating = normalizeStoredRating(rating);
  if (!normalizedRating) return '';
  if (settings.ratingSystem === '1-100') return String(Math.round(normalizedRating));
  return (normalizedRating / 10).toFixed(1).replace(/\.0$/, '');
}

/**
 * Get user initials from display name or email
 * @param {Object} user - Firebase user object
 * @returns {string} User initials (max 2 chars)
 */
export function getUserInitials(user) {
  if (!user) return 'U';
  const name = user.displayName || user.email || 'User';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
}

/**
 * Get poster URL for a media item, handling various URL formats
 * @param {Object} item - Media item with poster_path
 * @returns {string} Valid poster URL or placeholder
 */
export function getPosterUrl(item) {
  if (!item?.poster_path) {
    return 'https://placehold.co/90x135/374151/e5e7eb?text=No+Image';
  }
  if (String(item.poster_path).startsWith('http')) {
    return item.poster_path;
  }
  return `https://image.tmdb.org/t/p/w342${item.poster_path}`;
}

/**
 * Calculate movie progress (percentage watched)
 * @param {Object} item - Movie item with watchTime and runtime
 * @returns {Object} Score and label for display
 */
export function getMovieProgress(item) {
  const minutesWatched = Number(item?.watchTime) || 0;
  const runtime = Number(item?.runtime) || 0;
  if (runtime > 0) {
    const percentWatched = Math.max(0, Math.min(100, (minutesWatched / runtime) * 100));
    return {
      score: percentWatched,
      label: `${Math.round(percentWatched)}% completion`
    };
  }
  return {
    score: minutesWatched,
    label: minutesWatched > 0 ? 'Calculating completion...' : 'In progress'
  };
}

/**
 * Calculate series progress (current season/episode)
 * @param {Object} item - Series item with episodesWatched and currentSeason
 * @returns {Object} Score and label for display
 */
export function getSeriesProgress(item) {
  const episodesBySeason = (item?.episodesWatched && typeof item.episodesWatched === 'object')
    ? item.episodesWatched
    : {};

  let currentSeason = Number(item?.currentSeason) || 0;
  if (!currentSeason) {
    const seasonNums = Object.keys(episodesBySeason)
      .map(k => Number(String(k).replace(/^s/i, '')))
      .filter(n => Number.isFinite(n) && n > 0);
    currentSeason = seasonNums.length ? Math.max(...seasonNums) : 0;
  }

  const currentEpisode = currentSeason > 0
    ? Number(episodesBySeason[`s${currentSeason}`] || 0)
    : 0;

  if (currentSeason > 0) {
    return {
      score: (currentSeason * 1000) + currentEpisode,
      label: `Season ${currentSeason}${currentEpisode > 0 ? ` • Episode ${currentEpisode}` : ''}`
    };
  }

  const watchedEpisodes = typeof item?.episodesWatched === 'object'
    ? Object.values(item.episodesWatched || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
    : (Number(item?.episodesWatched) || 0);

  return {
    score: watchedEpisodes,
    label: watchedEpisodes > 0 ? `${watchedEpisodes} episodes watched` : 'In progress'
  };
}

/**
 * Format a date for activity display (relative time)
 * @param {Date|string} date - Date to format
 * @returns {string} Relative time string
 */
export function formatActivityDate(date) {
  if (!date) return 'recently';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString();
}
