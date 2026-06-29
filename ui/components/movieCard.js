import { IMAGE_BASE_URL as TMDB_IMAGE_BASE_URL } from '../../api/tmdb.js';
// TVDB image base is kept for legacy tvdb_ records; new TV cards use TMDb.
// import { IMAGE_BASE_URL as TVDB_IMAGE_BASE_URL } from '../../api/tvdb.js';
import { settings } from '../../settings.js';
import { escapeAttribute, escapeHtml, formatStoredRating } from '../../utils/helpers.js';

const TVDB_IMAGE_BASE_URL = 'https://artworks.thetvdb.com/banners';

function isMovieRecord(movie = {}) {
    if (movie.type === 'movie' || movie.media_type === 'movie') return true;
    if (movie.type === 'series' || movie.media_type === 'tv') return false;
    return Boolean(movie.title || movie.release_date || movie.tmdb_id);
}

function getImageBaseUrl(movie, isMovie) {
    const isLegacyTvdb = String(movie.dbId || '').startsWith('tvdb_');
    return !isMovie && isLegacyTvdb ? TVDB_IMAGE_BASE_URL : TMDB_IMAGE_BASE_URL;
}

export function renderMovieCard(movie, options = {}) {
    const isMovie = isMovieRecord(movie);
    const imageBaseUrl = getImageBaseUrl(movie, isMovie);

    let posterPath;
    if (movie.poster_path) {
        const posterValue = String(movie.poster_path);
        if (posterValue.startsWith('http')) {
            posterPath = posterValue;
        } else {
            posterPath = `${imageBaseUrl}${posterValue}`;
        }
    } else {
        posterPath = 'https://placehold.co/500x750/1f2937/4b5563?text=No+Image';
    }

    const title = movie.title || movie.name || 'Untitled';
    const year = movie.release_date ? movie.release_date.split('-')[0] : (movie.first_air_date ? movie.first_air_date.split('-')[0] : 'N/A');
    const dbId = movie.dbId || (isMovie ? `tmdb_${movie.id}` : `tmdb_tv_${movie.id}`);
    const typeLabel = isMovie ? 'movie' : 'series';
    const tmdbRating = (typeof movie.tmdbRating === 'number' && movie.tmdbRating > 0) ? movie.tmdbRating : null;
    const tvdbRating = (typeof movie.tvdbRating === 'number' && movie.tvdbRating > 0) ? movie.tvdbRating : null;

    let progressHtml = '';
    if (!isMovie && movie.currentSeason && movie.episodesWatched) {
        const currentEps = typeof movie.episodesWatched === 'object' ? (movie.episodesWatched[`s${movie.currentSeason}`] || 0) : 0;
        if (currentEps > 0) {
            progressHtml = ` <span class="mx-1">•</span> S${movie.currentSeason} • ${currentEps} eps`;
        }
    }

    const rating = tmdbRating || tvdbRating;
    const titleRatingHtml = rating
        ? `<span class="rating-badge media-card-title-rating"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z"/></svg>${rating.toFixed(1)}</span>`
        : '';

    return `
        <article class="movie-card media-card media-card--${escapeAttribute(options.variant || 'grid')}" tabindex="0" role="button" aria-label="View ${escapeAttribute(title)} details" data-movie-id="${escapeAttribute(dbId)}" data-media-type="${escapeAttribute(typeLabel)}">
            <div class="media-poster">
                <img src="${escapeAttribute(posterPath)}" alt="${escapeAttribute(title)} poster" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/500x750/14181d/9298a1?text=No+poster'">
                <div class="media-card-overlay">
                    <button type="button" class="movie-watchlist-btn media-quick-action" aria-label="Add ${escapeAttribute(title)} to watchlist" data-movie-id="${escapeAttribute(dbId)}">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                </div>
            </div>
            <span class="sr-only">${escapeHtml(typeLabel)}</span>
            <div class="media-card-copy">
                <h3 class="media-card-title"><span class="media-card-title-text">${escapeHtml(title)}</span>${titleRatingHtml}</h3>
                <p class="media-card-meta"><span>${escapeHtml(year)}${progressHtml}</span></p>
            </div>
        </article>
    `;
}

export function renderMovieListItem(movie, userMovieData = {}) {
    const isMovie = isMovieRecord(movie);
    const imageBaseUrl = getImageBaseUrl(movie, isMovie);

    let posterPath;
    if (movie.poster_path) {
        const posterValue = String(movie.poster_path);
        if (posterValue.startsWith('http')) {
            posterPath = posterValue;
        } else {
            posterPath = `${imageBaseUrl}${posterValue}`;
        }
    } else {
        posterPath = 'https://placehold.co/100x150/1f2937/4b5563?text=No+Image';
    }

    const title = movie.title || movie.name || 'Untitled';
    const dbId = movie.dbId || (isMovie ? `tmdb_${movie.id}` : `tmdb_tv_${movie.id}`);
    const typeLabel = isMovie ? 'MOVIE' : 'SERIES';
    const userRating = formatStoredRating(userMovieData.rating, settings);

    let progressHtml = '';
    let progressDisplay = '';
    if (!isMovie && movie.totalEpisodes && userMovieData.episodesWatched) {
        let totalEps = 0;
        let watchedEps = 0;

        if (typeof movie.totalEpisodes === 'object') {
            totalEps = Object.values(movie.totalEpisodes).reduce((a, b) => a + b, 0);
        } else {
            totalEps = movie.totalEpisodes;
        }

        if (typeof userMovieData.episodesWatched === 'object') {
            watchedEps = Object.values(userMovieData.episodesWatched).reduce((a, b) => a + b, 0);
        } else {
            watchedEps = userMovieData.episodesWatched;
        }

        if (watchedEps > 0) {
            progressDisplay = `${watchedEps}/${totalEps}`;
            progressHtml = `<span class="text-gray-400">${progressDisplay}</span>`;
        }
    }

    return `
        <div class="movie-list-item group flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800 transition-colors border-b border-gray-700 last:border-b-0" data-movie-id="${escapeAttribute(dbId)}">
            <img src="${escapeAttribute(posterPath)}" alt="${escapeAttribute(title)}" class="movie-list-poster w-16 h-24 object-cover rounded-md flex-shrink-0 cursor-pointer" data-movie-id="${escapeAttribute(dbId)}">
            <div class="flex-grow min-w-0">
                <a href="#" class="movie-list-title block text-sm font-semibold text-white hover:text-sky-300 transition-colors truncate" data-movie-id="${escapeAttribute(dbId)}">${escapeHtml(title)}</a>
                <p class="text-xs text-gray-400">${escapeHtml(typeLabel)}</p>
            </div>
            <div class="flex items-center gap-8 flex-shrink-0 text-right">
                ${userRating ? `<div class="text-right"><p class="text-lg font-bold text-yellow-400">${escapeHtml(userRating)}</p></div>` : '<div></div>'}
                ${progressHtml ? `<div class="text-center">${progressHtml}</div>` : '<div></div>'}
            </div>
        </div>
    `;
}
