import { IMAGE_BASE_URL as TMDB_IMAGE_BASE_URL } from '../../api/tmdb.js';
// TVDB image base is kept only for legacy tvdb_ records; new TV details use TMDb.
// import { IMAGE_BASE_URL as TVDB_IMAGE_BASE_URL } from '../../api/tvdb.js';
import { escapeAttribute, escapeHtml, formatActivityDate, formatStoredRating } from '../../utils/helpers.js';

const TVDB_IMAGE_BASE_URL = 'https://artworks.thetvdb.com/banners';

function getImageUrl(path, baseUrl, fallbackText = 'No Image') {
    if (!path) return `https://placehold.co/500x750/1f2937/4b5563?text=${encodeURIComponent(fallbackText)}`;
    return String(path).startsWith('http') ? path : `${baseUrl}${path}`;
}

function formatMoney(value, { minimumReliableAmount = 1000 } = {}) {
    const amount = Number(value);
    // TMDB occasionally contains tiny placeholder values (for example, 1).
    // Hiding those is safer than presenting them as verified production data.
    if (!Number.isFinite(amount) || amount < minimumReliableAmount) return 'Not reported';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRuntime(minutes) {
    const total = Number(minutes) || 0;
    if (!total) return 'N/A';
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function renderInfoItem(label, value) {
    return `
        <div class="border-b border-gray-700 pb-3">
            <p class="text-xs uppercase tracking-wide text-gray-500">${escapeHtml(label)}</p>
            <p class="text-sm text-gray-200 mt-1">${value || 'N/A'}</p>
        </div>
    `;
}

function renderPersonChip(person, roleText = '', options = {}) {
    const rawName = person?.name || person?.personName || 'Unknown';
    const name = escapeHtml(rawName);
    const id = person?.id;
    const role = roleText || person?.character || person?.job || '';
    const personType = options.personType || (['Director', 'Creator'].includes(person?.job) ? 'director' : 'actor');
    const variantClass = options.compact ? 'person-bubble--compact' : '';
    const profilePath = person?.profile_path || person?.profilePath || '';
    return `
        <div class="person-bubble ${variantClass}">
            ${id
                ? `<button type="button" class="actor-link person-bubble-link" data-actor-id="${escapeAttribute(id)}" data-actor-name="${escapeAttribute(rawName)}" data-actor-role="${escapeAttribute(role)}" data-profile-path="${escapeAttribute(profilePath)}">
                    <span class="person-bubble-name">${name}</span>
                    ${role ? `<span class="person-bubble-role">${escapeHtml(role)}</span>` : ''}
                  </button>`
                : `<div class="person-bubble-link"><span class="person-bubble-name">${name}</span>${role ? `<span class="person-bubble-role">${escapeHtml(role)}</span>` : ''}</div>`}
            ${options.showFollow && id ? `<button type="button" class="follow-person-btn person-bubble-follow" aria-label="Follow ${escapeAttribute(rawName)}" data-person-id="${escapeAttribute(id)}" data-person-type="${escapeAttribute(personType)}" data-person-name="${escapeAttribute(rawName)}" data-profile-path="${escapeAttribute(profilePath)}">Follow</button>` : ''}
        </div>
    `;
}

function getMovieControlFields(movie, options = {}) {
    const isSeries = movie.type === 'series' || movie.media_type === 'tv';
    const movieInfo = options.movieInfo || {};
    const currentStatus = movieInfo.status || '';
    const settings = options.settings || {};
    const currentRating = formatStoredRating(movieInfo.rating, settings);
    const runtime = movie.runtime || null;
    const tmdbRating = (typeof movie.tmdbRating === 'number' && movie.tmdbRating > 0) ? movie.tmdbRating : null;
    const tvdbRating = (typeof movie.tvdbRating === 'number' && movie.tvdbRating > 0) ? movie.tvdbRating : null;
    const officialRatingLabel = isSeries && tvdbRating && !tmdbRating ? 'TVDB' : 'TMDb';
    const officialRatingValue = isSeries ? (tmdbRating || tvdbRating) : tmdbRating;
    const officialRatingHtml = officialRatingValue
        ? `<span class="ml-2 px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-200">${officialRatingLabel}: ${officialRatingValue.toFixed(1)}</span>`
        : '';

    let ratingMax = settings.ratingSystem === '1-100' ? 100 : 10;
    let placeholder = settings.ratingSystem === '1-100' ? 'Rate 1-100' : 'Rate 1-10';
    const ratingHtml = `<input id="modal-rating-input" type="number" min="1" max="${ratingMax}" placeholder="${escapeAttribute(placeholder)}" value="${escapeAttribute(currentRating)}" class="w-24 bg-gray-700 text-white rounded px-2 py-1.5 text-sm" aria-label="Movie rating" />`;

    let seriesProgressHtml = '';
    if (isSeries) {
        const episodesData = movieInfo.episodesWatched || {};
        const currentSeason = movieInfo.currentSeason || 1;

        const seasonsArray = Array.isArray(movie.seasons) ? movie.seasons : [];
        const defaultSeasonType = movie.defaultSeasonType || null;
        const filteredSeasons = defaultSeasonType
            ? seasonsArray.filter(s => s.type && Number(s.type.id) === Number(defaultSeasonType))
            : seasonsArray;
        const seasonNumbers = Array.from(new Set(
            filteredSeasons
                .map(s => Number(s.number ?? s.season_number))
                .filter(n => Number.isInteger(n) && n > 0)
        )).sort((a, b) => a - b);

        const resolvedSeason = seasonNumbers.length && !seasonNumbers.includes(currentSeason)
            ? seasonNumbers[0]
            : currentSeason;
        const currentEpisodes = typeof episodesData === 'object'
            ? (episodesData[`s${resolvedSeason}`] || 0)
            : (episodesData || 0);

        let numSeasons = seasonNumbers.length
            ? seasonNumbers.length
            : (movie.numberOfSeasons || seasonsArray.length || 1);
        if (typeof numSeasons !== 'number' || numSeasons < 1) numSeasons = 1;

        const seasonOptions = seasonNumbers.length
            ? seasonNumbers.map(season => {
                const episodes = typeof episodesData === 'object' ? (episodesData[`s${season}`] || 0) : 0;
                const progress = episodes > 0 ? ` (${episodes} eps)` : '';
                return `<option value="${season}" ${season === resolvedSeason ? 'selected' : ''}>Season ${season}${progress}</option>`;
            }).join('')
            : Array.from({ length: numSeasons }, (_, i) => {
                const season = i + 1;
                const episodes = typeof episodesData === 'object' ? (episodesData[`s${season}`] || 0) : 0;
                const progress = episodes > 0 ? ` (${episodes} eps)` : '';
                return `<option value="${season}" ${season === resolvedSeason ? 'selected' : ''}>Season ${season}${progress}</option>`;
            }).join('');

        seriesProgressHtml = `
            <div class="flex items-center gap-3 mt-3">
                <span class="text-sm text-gray-300">Season:</span>
                <select id="modal-season-select" class="bg-gray-700 text-white rounded px-3 py-1.5 text-sm" aria-label="Season">
                    ${seasonOptions}
                </select>
                <span class="text-sm text-gray-300">Episodes:</span>
                <input id="modal-episodes-input" type="number" min="0" value="${currentEpisodes}" class="w-20 bg-gray-700 text-white rounded px-3 py-1.5 text-sm" aria-label="Episodes watched" placeholder="0" />
                <span id="modal-episodes-total" class="text-xs text-gray-400">/ --</span>
            </div>
        `;
    }

    let watchProgressHtml = '';
    if (currentStatus === 'watching' && !isSeries && runtime) {
        const pct = movieInfo.watchTime ? Math.min(100, Math.round((Number(movieInfo.watchTime) / runtime) * 100)) : 0;
        const watchVal = movieInfo.watchTime ?? '';
        watchProgressHtml = `
            <div id="modal-watchtime" class="mt-3">
                <label class="block text-xs text-gray-300 mb-1">Progress</label>
                <div class="flex items-center gap-3">
                    <input id="modal-watchtime-input" type="number" min="0" max="${runtime}" value="${watchVal}" class="w-28 bg-gray-700 text-white rounded px-2 py-1 text-sm" aria-label="Minutes watched" />
                    <div class="flex-1">
                        <div class="w-full bg-gray-700 rounded h-2 overflow-hidden">
                            <div id="modal-progress-bar" class="h-2 rounded bg-green-500" style="width: ${pct}%;"></div>
                        </div>
                        <div id="modal-progress-label" class="text-xs text-gray-400 mt-1">${pct}% (${watchVal} / ${runtime} min)</div>
                    </div>
                </div>
            </div>
        `;
    }

    const statusControlHtml = `
        <select id="modal-status-select" class="text-sm bg-gray-700 text-white px-2 py-1 rounded">
            <option value="">Not set</option>
            <option value="watching" ${currentStatus === 'watching' ? 'selected' : ''}>Watching</option>
            <option value="watched" ${currentStatus === 'watched' ? 'selected' : ''}>Watched</option>
            <option value="planning" ${currentStatus === 'planning' ? 'selected' : ''}>Planning</option>
            <option value="dropped" ${currentStatus === 'dropped' ? 'selected' : ''}>Dropped</option>
        </select>
    `;

    const addButtonHtml = movieInfo && (movieInfo.status || movieInfo.rating)
        ? 'Remove from list'
        : 'Add to List';

    const controlsHtml = `
        <section class="tracking-panel mt-4 mb-2" aria-label="Tracking controls">
            <div class="flex items-start justify-between gap-6 mb-3">
                <div class="flex items-center gap-3">
                    <div class="text-sm text-gray-300">Status:</div>
                    ${statusControlHtml}
                </div>
                <div class="flex flex-col items-end gap-2">
                    <div class="flex items-center gap-3">
                        <div class="text-sm text-gray-300">Rating:</div>
                        ${ratingHtml}
                        <div class="relative">
                            <button type="button" id="modal-add-to-list-btn" class="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-md text-sm">${addButtonHtml}</button>
                            <div id="modal-add-popover" class="hidden absolute right-0 mt-2 w-44 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 text-sm">
                                <button type="button" class="w-full text-left px-3 py-2 hover:bg-gray-700 modal-list-option" data-status="watching">Watching</button>
                                <button type="button" class="w-full text-left px-3 py-2 hover:bg-gray-700 modal-list-option" data-status="watched">Watched</button>
                                <button type="button" class="w-full text-left px-3 py-2 hover:bg-gray-700 modal-list-option" data-status="planning">Planned</button>
                            </div>
                        </div>
                    </div>
                    ${seriesProgressHtml}
                </div>
            </div>
        </section>

        ${watchProgressHtml}
    `;

    return {
        statusControlHtml,
        ratingControlHtml: ratingHtml,
        addButtonHtml,
        controlsHtml
    };
}

function renderMovieControls(movie, credits, options = {}) {
    const controlFields = getMovieControlFields(movie, options);
    return controlFields.controlsHtml || '';
}

export function renderScoreDistribution(ratingSummary = {}) {
    const buckets = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const averageRating = Number(ratingSummary?.averageRating) || 0;
    const averageScore = averageRating
        ? Math.round(averageRating <= 10 ? averageRating * 10 : averageRating)
        : 0;
    const ratingCount = Number(ratingSummary?.ratingCount) || Object.values(ratingSummary?.distribution || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const distribution = { ...(ratingSummary?.distribution || {}) };
    if (ratingCount > 0 && averageScore && !Object.values(distribution).some(value => Number(value) > 0)) {
        const averageBucket = String(Math.max(10, Math.min(100, Math.ceil(averageScore / 10) * 10)));
        distribution[averageBucket] = ratingCount;
    }
    const maxCount = Math.max(1, ...buckets.map(bucket => Number(distribution[String(bucket)] || 0)));
    const hasDistribution = ratingCount > 0;

    const bars = buckets.map((bucket) => {
        const count = Number(distribution[String(bucket)] || 0);
        const height = hasDistribution ? Math.max(10, Math.round((count / maxCount) * 58)) : 8;
        const colorClass = bucket <= 30
            ? 'bg-red-500'
            : bucket <= 50
                ? 'bg-amber-400'
                : bucket <= 70
                    ? 'bg-yellow-300'
                    : 'bg-lime-400';

        return `
            <div class="flex flex-col items-center justify-end min-w-0">
                <div class="h-20 flex items-end">
                    <div class="text-center">
                        <p class="text-xs text-gray-400 mb-1">${count ? count.toLocaleString() : ''}</p>
                        <div class="w-4 rounded-full ${colorClass}" style="height: ${height}px"></div>
                    </div>
                </div>
                <p class="text-xs text-sky-300 mt-1">${bucket}</p>
            </div>
        `;
    }).join('');

    return `
        <div id="score-distribution-section">
            <div class="flex items-center justify-between gap-4 mb-3">
                <h2 class="text-xl font-bold text-sky-300">Blist Score Distribution</h2>
                <div class="text-right">
                    <p class="text-xs uppercase tracking-wide text-gray-500">Average Score</p>
                    <p class="text-lg font-bold text-white">${averageScore || 'N/A'}${ratingCount ? `<span class="text-xs font-normal text-gray-400 ml-2">${ratingCount.toLocaleString()} ratings</span>` : ''}</p>
                </div>
            </div>
            <div class="rounded-md border border-gray-800 bg-gray-900 p-4">
                ${hasDistribution
                    ? `<div class="grid grid-cols-10 gap-3 items-end">${bars}</div>`
                    : '<p class="text-sm text-gray-400">No user ratings yet.</p>'}
            </div>
        </div>
    `;
}

function getReviewTime(review = {}) {
    const value = review.updatedAt || review.createdAt;
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function getReviewInitials(review = {}) {
    if (review.authorInitials) return review.authorInitials;
    return String(review.authorName || 'U')
        .split(/[\s._-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';
}

export function renderMovieReviews(reviews = [], currentUserId = '', settings = {}) {
    if (!reviews.length) {
        return '<p class="text-sm text-gray-400">No reviews yet. Be the first to write one.</p>';
    }

    return reviews.map((review) => {
        const isOwn = String(review.authorId || '') === String(currentUserId || '');
        const authorName = review.authorName || 'Blist User';
        const initials = getReviewInitials(review);
        const score = formatStoredRating(review.rating, settings);

        return `
            <article class="rounded-md border border-gray-800 bg-gray-900 p-4">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-md bg-gradient-to-br from-sky-500 to-red-500 text-white font-bold flex items-center justify-center flex-shrink-0">
                            ${escapeHtml(initials)}
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <p class="text-white font-semibold truncate">${escapeHtml(authorName)}</p>
                                ${isOwn ? '<span class="text-[11px] rounded bg-sky-900 text-sky-200 px-2 py-0.5 border border-sky-800">You</span>' : ''}
                            </div>
                            <p class="text-xs text-gray-500">${escapeHtml(formatActivityDate(getReviewTime(review)))}</p>
                        </div>
                    </div>
                    <button type="button" class="follow-user-btn text-sm text-white px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500" data-user-id="${escapeAttribute(review.authorId || '')}" data-user-name="${escapeAttribute(authorName)}" data-user-photo="${escapeAttribute(review.authorPhotoURL || '')}" data-user-initials="${escapeAttribute(initials)}">
                        Follow
                    </button>
                </div>
                ${score ? `<p class="text-sm text-sky-200 mt-4">Score ${escapeHtml(score)}</p>` : ''}
                <p class="text-gray-200 mt-3 whitespace-pre-line">${escapeHtml(review.text || '')}</p>
            </article>
        `;
    }).join('');
}

// Render the movie detail modal. Accepts movie, credits, and an options object:
// options.movieInfo (object from user's list; may contain status, rating, watchTime, episodesWatched), options.settings
export function renderModal(movie, credits, options = {}) {
    const isSeries = movie.type === 'series' || movie.media_type === 'tv';
    const isLegacyTvdb = String(movie.dbId || '').startsWith('tvdb_');
    const imageBaseUrl = isSeries && isLegacyTvdb ? TVDB_IMAGE_BASE_URL : TMDB_IMAGE_BASE_URL;

    // Handle poster path - TVDB might return full URLs or paths
    let posterPath;
    const imageSrc = movie.poster_path || movie.image;
    if (imageSrc) {
        if (String(imageSrc).startsWith('http')) {
            posterPath = String(imageSrc); // Already a full URL
        } else {
            posterPath = `${imageBaseUrl}${imageSrc}`;
        }
    } else {
        posterPath = 'https://placehold.co/500x750/1f2937/4b5563?text=No+Image';
    }
    const backdropPath = movie.backdrop_path
        ? `${TMDB_IMAGE_BASE_URL.replace('/w500', '/original')}${movie.backdrop_path}`
        : posterPath;

    const runtime = movie.runtime || null;
    const tmdbRating = (typeof movie.tmdbRating === 'number' && movie.tmdbRating > 0) ? movie.tmdbRating : null;
    const tvdbRating = (typeof movie.tvdbRating === 'number' && movie.tvdbRating > 0) ? movie.tvdbRating : null;
    const officialRatingLabel = isSeries && tvdbRating && !tmdbRating ? 'TVDB' : 'TMDb';
    const officialRatingValue = isSeries ? (tmdbRating || tvdbRating) : tmdbRating;
    const officialRatingHtml = officialRatingValue
        ? `<span class="ml-2 px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-200">${officialRatingLabel}: ${officialRatingValue.toFixed(1)}</span>`
        : '';

    const director = credits?.crew?.find(c => c.job === 'Director') || credits?.crew?.find(c => c.job === 'Creator');
    const directorLabel = director?.job === 'Creator' ? 'Creator' : 'Director';
    const cast = credits?.cast?.slice(0, 6) || [];
    const title = movie.title || movie.name || 'Untitled';
    const originalTitle = movie._originalTitle || title;
    const overviewEnglish = movie.overviewEnglish || movie.overview || 'No description available.';
    const overviewOriginal = movie.overviewOriginal || movie.overview || '';
    const overview = movie.overview || 'No description available.';
    const releaseYear = movie.release_date
        ? movie.release_date.split('-')[0]
        : (movie.first_air_date ? String(movie.first_air_date).split('-')[0] : 'N/A');
    const genres = Array.isArray(movie.genres)
        ? movie.genres
            .map(genre => ({
                id: typeof genre === 'string' ? '' : genre?.id,
                name: typeof genre === 'string' ? genre : genre?.name
            }))
            .filter(genre => genre.name)
        : [];
    const tags = Array.isArray(movie.keywords)
        ? movie.keywords
            .map(tag => ({ id: tag?.id, name: tag?.name }))
            .filter(tag => tag.id && tag.name)
            .slice(0, 10)
        : [];

    const controlsHtml = renderMovieControls(movie, credits, options);

    return `
        <button type="button" id="close-modal" aria-label="Close movie details" class="absolute top-2 right-3 text-gray-300 hover:text-white z-20 text-3xl leading-none">&times;</button>
        <div class="modal-backdrop-art" aria-hidden="true">
            <img src="${escapeAttribute(backdropPath)}" alt="">
            <span></span>
        </div>
        <div class="modal-poster-panel w-full md:w-72 flex-shrink-0 bg-gray-900 md:rounded-l-lg">
            <img src="${escapeAttribute(posterPath)}" alt="${escapeAttribute(title)} Poster" class="modal-poster-img w-full object-cover">
        </div>
        <div class="modal-info-panel w-full flex flex-col p-4 md:p-6 overflow-hidden">
            <div class="flex-grow overflow-y-auto pr-2">
                <h2 id="modal-title" class="text-xl lg:text-2xl font-bold text-white mb-2" data-title-english="${escapeAttribute(title)}" data-title-original="${escapeAttribute(originalTitle)}">${escapeHtml(title)}</h2>
                <div class="text-sm text-gray-400 mb-4">
                    <span>${escapeHtml(releaseYear)}</span>
                    ${!isSeries && runtime ? `<span class="mx-2">•</span><span>${runtime} min</span>` : ''}
                    ${isSeries ? `<span class="mx-2">•</span><span>TV Series</span>` : ''}
                    ${officialRatingHtml}
                </div>

                <button type="button" id="modal-view-full-page-btn" class="modal-full-page-btn">
                    <span>View full page</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>
                </button>

                <div class="mb-4">
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="font-semibold text-white text-sm">Description</h4>
                        ${movie.hasMultipleLanguages ? `
                            <button id="toggle-language-btn" type="button" class="text-xs text-sky-400 hover:text-sky-300 transition-colors" data-showing="english">
                                Show Original
                            </button>
                        ` : movie.needsTranslation ? `
                            <button id="translate-btn" type="button" class="text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1">
                                <span>Translate to English</span>
                            </button>
                        ` : ''}
                    </div>
                    <p id="modal-overview-text" class="text-gray-300 mb-4 text-sm" data-overview-english="${escapeAttribute(overviewEnglish)}" data-overview-original="${escapeAttribute(overviewOriginal)}">${escapeHtml(overview)}</p>
                </div>

                ${controlsHtml}

                ${genres.length ? `
                    <div class="mb-4">
                        <h4 class="font-semibold text-white text-sm mb-2">Genres</h4>
                        <div class="flex flex-wrap gap-2">${genres.map(genre => `
                            <button type="button" class="movie-genre-chip text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1 hover:border-sky-400 hover:text-white transition-colors" data-media-type="${isSeries ? 'series' : 'movie'}" data-genre-id="${escapeAttribute(genre.id || '')}" data-genre-name="${escapeAttribute(genre.name)}">
                                ${escapeHtml(genre.name)}
                            </button>
                        `).join('')}</div>
                    </div>
                ` : ''}

                ${tags.length ? `
                    <div class="mb-4">
                        <h4 class="font-semibold text-white text-sm mb-2">Tags & Themes</h4>
                        <div class="flex flex-wrap gap-2">${tags.map(tag => `
                            <button type="button" class="media-tag-chip text-xs bg-gray-900 border border-gray-700 text-gray-300 rounded px-2 py-1 hover:border-sky-400 hover:text-white transition-colors" data-media-type="${isSeries ? 'series' : 'movie'}" data-keyword-id="${escapeAttribute(tag.id)}" data-keyword-name="${escapeAttribute(tag.name)}">
                                ${escapeHtml(tag.name)}
                            </button>
                        `).join('')}</div>
                    </div>
                ` : ''}

                <div class="mb-4">
                    <h4 class="font-semibold text-white text-sm">${escapeHtml(directorLabel)}</h4>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${director ? renderPersonChip(director, directorLabel, { compact: true, showFollow: true, personType: 'director' }) : '<p class="text-gray-400 text-sm">N/A</p>'}
                    </div>
                </div>

                <div>
                    <h4 class="font-semibold text-white text-sm">Cast</h4>
                    <div id="modal-cast-list" class="flex flex-wrap gap-2 mt-1">
                        ${cast.map(person => renderPersonChip(person, person.character, { compact: true, showFollow: true })).join('')}
                    </div>
                </div>

            </div>

            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
                <div class="text-sm text-gray-300">Last updated: <span class="text-gray-400 text-sm">${escapeHtml(releaseYear)}</span></div>
                <div></div>
            </div>
        </div>
    `;
}

export function renderMoviePage(movie, credits, options = {}) {
    const isSeries = movie.type === 'series' || movie.media_type === 'tv';
    const isLegacyTvdb = String(movie.dbId || '').startsWith('tvdb_');
    const imageBaseUrl = isSeries && isLegacyTvdb ? TVDB_IMAGE_BASE_URL : TMDB_IMAGE_BASE_URL;
    const posterPath = getImageUrl(movie.poster_path || movie.image, imageBaseUrl, 'No Poster');
    const backdropPath = movie.backdrop_path
        ? getImageUrl(movie.backdrop_path, TMDB_IMAGE_BASE_URL, 'Backdrop')
        : posterPath;
    const title = escapeHtml(movie.title || movie.name || 'Untitled');
    const overview = escapeHtml(movie.overview || movie.overviewEnglish || 'No description available.');
    const tagline = movie.tagline ? escapeHtml(movie.tagline) : '';
    const releaseDate = movie.release_date || movie.first_air_date || movie.firstAired || '';
    const year = releaseDate ? String(releaseDate).slice(0, 4) : 'N/A';
    const runtime = isSeries
        ? (movie.averageRuntime || movie.runtime || movie.average_runtime)
        : movie.runtime;
    const ratingValue = isSeries
        ? (movie.tvdbRating || movie.score || movie.averageRating)
        : (movie.tmdbRating || movie.vote_average);
    const ratingLabel = ratingValue ? Number(ratingValue).toFixed(1) : 'N/A';
    const voteCount = movie.vote_count ? Number(movie.vote_count).toLocaleString() : '';
    const genres = Array.isArray(movie.genres)
        ? movie.genres
            .map(genre => ({
                id: typeof genre === 'string' ? '' : genre?.id,
                name: typeof genre === 'string' ? genre : genre?.name
            }))
            .filter(genre => genre.name)
        : [];
    const tags = Array.isArray(movie.keywords)
        ? movie.keywords
            .map(tag => ({
                id: tag?.id,
                name: tag?.name
            }))
            .filter(tag => tag.id && tag.name)
            .slice(0, 12)
        : [];
    const cast = (credits?.cast || []).slice(0, 12);
    const crew = (credits?.crew || [])
        .filter(member => ['Director', 'Creator', 'Screenplay', 'Writer', 'Producer', 'Executive Producer'].includes(member.job))
        .slice(0, 8);
    const companies = Array.isArray(movie.production_companies)
        ? movie.production_companies.map(company => company.name).filter(Boolean).slice(0, 4)
        : [];
    const homepage = movie.homepage || movie.officialSite || '';
    const imdbUrl = movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}/` : '';
    const collection = movie.belongs_to_collection?.name || '';
    const status = movie.status?.name || movie.status || 'N/A';
    const controlFields = getMovieControlFields(movie, options);
    const statusControlHtml = controlFields.statusControlHtml || '';
    const ratingControlHtml = controlFields.ratingControlHtml || '';
    const addButtonHtml = controlFields.addButtonHtml || '';
    const ratingSummary = options.ratingSummary || {};
    const currentUser = options.currentUser || null;
    const settings = options.settings || {};
    const reviewRatingMax = settings.ratingSystem === '1-100' ? 100 : 10;
    const reviewRatingPlaceholder = settings.ratingSystem === '1-100' ? '1-100' : '1-10';
    const currentReviewRating = formatStoredRating(options.movieInfo?.rating, settings);
    const backLabels = {
        'browse-movies': 'Back to films',
        'browse-series': 'Back to series',
        'my-list': 'Back to my list',
        'user-profile': 'Back to profile'
    };
    const backLabel = backLabels[options.backPage] || 'Back home';

    return `
        <div class="relative w-full text-white">
            <button type="button" id="movie-page-back-btn" aria-label="${escapeAttribute(backLabel)}" class="movie-page-back-btn">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
                <span>${escapeHtml(backLabel)}</span>
            </button>
            <section class="relative min-h-[430px] flex items-end bg-gray-950">
                <img src="${escapeAttribute(backdropPath)}" alt="" class="absolute inset-0 w-full h-full object-cover opacity-35">
                <div class="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/75 to-gray-950/25"></div>
                <div class="relative z-10 w-full p-5 md:p-8">
                    <div class="flex flex-col md:flex-row gap-6 md:items-end">
                        <img src="${escapeAttribute(posterPath)}" alt="${title} poster" class="w-36 md:w-48 aspect-[2/3] object-cover rounded-md border border-gray-700 shadow-xl">
                        <div class="max-w-3xl">
                            <div class="flex flex-wrap gap-2 mb-3">
                                <span class="text-xs uppercase tracking-wide bg-sky-600/90 px-2 py-1 rounded">${isSeries ? 'Series' : 'Movie'}</span>
                                <span class="text-xs bg-gray-800/90 px-2 py-1 rounded">${year}</span>
                                <span class="text-xs bg-gray-800/90 px-2 py-1 rounded">${formatRuntime(runtime)}</span>
                                <span class="inline-flex items-center gap-1 text-xs bg-gray-800/90 px-2 py-1 rounded">
                                    <span class="text-yellow-300">&#9733;</span>
                                    <span>IMDb ${ratingLabel}${voteCount ? ` (${voteCount})` : ''}</span>
                                </span>
                            </div>
                            <h1 class="text-3xl md:text-5xl font-bold leading-tight">${title}</h1>
                            ${tagline ? `<p class="text-sky-200 mt-2 text-lg">${tagline}</p>` : ''}
                            <p class="text-gray-200 mt-4 max-w-2xl leading-relaxed">${overview}</p>
                            ${genres.length ? `
                                <div class="mt-5">
                                    <p class="text-xs uppercase tracking-wide text-gray-400 mb-2">Genres</p>
                                    <div class="flex flex-wrap gap-2">${genres.map(genre => `
                                        <button type="button" class="movie-genre-chip text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1 hover:border-sky-400 hover:text-white transition-colors" data-media-type="${isSeries ? 'series' : 'movie'}" data-genre-id="${escapeHtml(genre.id || '')}" data-genre-name="${escapeHtml(genre.name)}">
                                            ${escapeHtml(genre.name)}
                                        </button>
                                    `).join('')}</div>
                                </div>
                            ` : ''}
                            ${tags.length ? `
                                <div class="mt-4">
                                    <p class="text-xs uppercase tracking-wide text-gray-400 mb-2">Tags & Themes</p>
                                    <div class="flex flex-wrap gap-2">${tags.map(tag => `
                                        <button type="button" class="media-tag-chip text-xs bg-gray-900 border border-gray-700 text-gray-300 rounded px-2 py-1 hover:border-sky-400 hover:text-white transition-colors" data-media-type="${isSeries ? 'series' : 'movie'}" data-keyword-id="${escapeHtml(tag.id)}" data-keyword-name="${escapeHtml(tag.name)}">
                                            ${escapeHtml(tag.name)}
                                        </button>
                                    `).join('')}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </section>

            <section class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 p-5 md:p-8 bg-gray-950">
                <div class="space-y-8">
                    <div>
                        <h2 class="text-xl font-bold mb-3">Your List</h2>
                        <div class="rounded-md border border-gray-700 bg-gray-900 p-4">
                            <div class="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div class="flex flex-wrap items-center gap-3">
                                    <label class="text-sm text-gray-300" for="modal-status-select">Status</label>
                                    ${statusControlHtml}
                                    <label class="text-sm text-gray-300" for="modal-rating-input">Rating</label>
                                    ${ratingControlHtml}
                                </div>
                                <button type="button" id="modal-add-to-list-btn" class="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-md text-sm">${addButtonHtml}</button>
                            </div>
                        </div>
                    </div>

                    ${renderScoreDistribution(ratingSummary)}

                    <div id="movie-reviews-section">
                        <div class="flex items-center justify-between gap-4 mb-3">
                            <h2 class="text-xl font-bold">Reviews</h2>
                            <span id="movie-review-count" class="text-sm text-gray-400"></span>
                        </div>
                        <div class="rounded-md border border-gray-700 bg-gray-900 p-4 mb-4">
                            ${currentUser ? `
                                <form id="movie-review-form" class="space-y-3">
                                    <div class="flex flex-col sm:flex-row gap-3">
                                        <input id="movie-review-rating" type="number" min="1" max="${reviewRatingMax}" value="${escapeAttribute(currentReviewRating)}" placeholder="Score ${reviewRatingPlaceholder}" class="sm:w-36 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                                        <input id="movie-review-title-context" type="text" value="${escapeAttribute(movie.title || movie.name || 'Untitled')}" class="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-300" disabled>
                                    </div>
                                    <textarea id="movie-review-text" rows="4" maxlength="2000" placeholder="Write your review..." class="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                                    <div class="flex justify-end">
                                        <button type="submit" class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-md text-sm font-semibold">Publish Review</button>
                                    </div>
                                </form>
                            ` : `
                                <p class="text-sm text-gray-400">Log in to write a review.</p>
                            `}
                        </div>
                        <div id="movie-reviews-list" class="space-y-4">
                            <p class="text-sm text-gray-400">Loading reviews...</p>
                        </div>
                    </div>

                    <div>
                        <h2 class="text-xl font-bold mb-3">Cast</h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            ${cast.length ? cast.map(person => renderPersonChip(person, person.character, { showFollow: true })).join('') : '<p class="text-sm text-gray-400">No cast listed.</p>'}
                        </div>
                    </div>

                    <div>
                        <h2 class="text-xl font-bold mb-3">Crew</h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            ${crew.length ? crew.map(person => renderPersonChip(person, person.job, { showFollow: true })).join('') : '<p class="text-sm text-gray-400">No crew listed.</p>'}
                        </div>
                    </div>
                </div>

                <aside class="rounded-md border border-gray-700 bg-gray-900 p-5 h-fit space-y-3">
                    <h2 class="text-xl font-bold mb-4">Details</h2>
                    ${renderInfoItem('Release Date', escapeHtml(formatDate(releaseDate)))}
                    ${renderInfoItem('Status', escapeHtml(status))}
                    ${renderInfoItem('Original Language', escapeHtml((movie.original_language || movie.originalLanguage || 'N/A').toUpperCase()))}
                    ${!isSeries ? renderInfoItem('Reported Budget', escapeHtml(formatMoney(movie.budget))) : ''}
                    ${!isSeries ? renderInfoItem('Reported Revenue', escapeHtml(formatMoney(movie.revenue))) : ''}
                    ${collection ? renderInfoItem('Collection', escapeHtml(collection)) : ''}
                    ${companies.length ? renderInfoItem('Studios', escapeHtml(companies.join(', '))) : ''}
                    ${(homepage || imdbUrl) ? `
                        <div class="pt-2 flex flex-wrap gap-2">
                            ${homepage ? `<a href="${escapeHtml(homepage)}" target="_blank" rel="noopener noreferrer" class="text-sm bg-sky-600 hover:bg-sky-500 px-3 py-1.5 rounded">Official Site</a>` : ''}
                            ${imdbUrl ? `<a href="${escapeHtml(imdbUrl)}" target="_blank" rel="noopener noreferrer" class="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded">IMDb</a>` : ''}
                        </div>
                    ` : ''}
                </aside>
            </section>
        </div>
    `;
}
