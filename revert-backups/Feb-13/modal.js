import { IMAGE_BASE_URL as TMDB_IMAGE_BASE_URL } from '../../api/tmdb.js';
import { IMAGE_BASE_URL as TVDB_IMAGE_BASE_URL } from '../../api/tvdb.js';

// Render the movie detail modal. Accepts movie, credits, and an options object:
// options.movieInfo (object from user's list; may contain status, rating, watchTime, episodesWatched), options.settings
export function renderModal(movie, credits, options = {}) {
    const isSeries = movie.type === 'series' || movie.media_type === 'tv';
    const imageBaseUrl = isSeries ? TVDB_IMAGE_BASE_URL : TMDB_IMAGE_BASE_URL;
    
    // Handle poster path - TVDB might return full URLs or paths
    let posterPath;
    const imageSrc = movie.poster_path || movie.image;
    if (imageSrc) {
        if (imageSrc.startsWith('http')) {
            posterPath = imageSrc; // Already a full URL
        } else {
            posterPath = `${imageBaseUrl}${imageSrc}`;
        }
    } else {
        posterPath = 'https://placehold.co/500x750/1f2937/4b5563?text=No+Image';
    }

    const director = credits?.crew?.find(c => c.job === 'Director') || credits?.crew?.find(c => c.job === 'Creator');
    const directorLabel = director?.job === 'Creator' ? 'Creator' : 'Director';
    const cast = credits?.cast?.slice(0, 6) || [];

    const movieInfo = options.movieInfo || {};
    const currentStatus = movieInfo.status || '';
    const currentRating = movieInfo.rating || '';
    const settings = options.settings || {};
    const runtime = movie.runtime || null;
    const tmdbRating = (typeof movie.tmdbRating === 'number' && movie.tmdbRating > 0) ? movie.tmdbRating : null;
    const tvdbRating = (typeof movie.tvdbRating === 'number' && movie.tvdbRating > 0) ? movie.tvdbRating : null;
    const officialRatingLabel = isSeries ? 'TVDB' : 'TMDb';
    const officialRatingValue = isSeries ? tvdbRating : tmdbRating;
    const officialRatingHtml = officialRatingValue
        ? `<span class="ml-2 px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-200">${officialRatingLabel}: ${officialRatingValue.toFixed(1)}</span>`
        : '';

    // Determine rating input for numeric system
    let ratingHtml = '';
    let ratingMax = settings.ratingSystem === '1-100' ? 100 : 10;
    let placeholder = settings.ratingSystem === '1-100' ? 'Rate 1-100' : 'Rate 1-10';
    ratingHtml = `<input id="modal-rating-input" type="number" min="1" max="${ratingMax}" placeholder="${placeholder}" value="${currentRating}" class="w-24 bg-gray-700 text-white rounded px-2 py-1.5 text-sm" aria-label="Movie rating" />`;

    // Progress section for series: always show for series
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
                .map(s => Number(s.number))
                .filter(n => Number.isInteger(n) && n > 0)
        )).sort((a, b) => a - b);

        const resolvedSeason = seasonNumbers.length && !seasonNumbers.includes(currentSeason)
            ? seasonNumbers[0]
            : currentSeason;
        const currentEpisodes = typeof episodesData === 'object'
            ? (episodesData[`s${resolvedSeason}`] || 0)
            : (episodesData || 0);

        // Fall back to a numeric count if we did not get a usable list
        let numSeasons = seasonNumbers.length
            ? seasonNumbers.length
            : (movie.numberOfSeasons || seasonsArray.length || 1);
        if (typeof numSeasons !== 'number' || numSeasons < 1) numSeasons = 1;

        console.log('Series seasons info:', {
            numberOfSeasons: movie.numberOfSeasons,
            defaultSeasonType: movie.defaultSeasonType,
            seasonsLength: seasonsArray.length,
            seasonNumbers,
            usingCount: numSeasons
        });

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

    // Progress section: minutes for movies when watching
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

    return `
        <button type="button" id="close-modal" aria-label="Close movie details" class="absolute top-2 right-3 text-gray-300 hover:text-white z-20 text-3xl leading-none">&times;</button>
        <div class="w-full md:w-72 flex-shrink-0 bg-gray-900 md:rounded-l-lg">
            <img src="${posterPath}" alt="${movie.title} Poster" class="w-full h-full object-contain">
        </div>
        <div class="w-full flex flex-col p-4 md:p-6 overflow-hidden">
            <div class="flex-grow overflow-y-auto pr-2">
                <h2 class="text-xl lg:text-2xl font-bold text-white mb-2">${movie.title}</h2>
                <div class="text-sm text-gray-400 mb-4">
                    <span>${movie.release_date ? movie.release_date.split('-')[0] : (movie.first_air_date ? String(movie.first_air_date).split('-')[0] : 'N/A')}</span>
                    ${!isSeries && runtime ? `<span class="mx-2">•</span><span>${runtime} min</span>` : ''}
                    ${isSeries ? `<span class="mx-2">•</span><span>TV Series</span>` : ''}
                    ${officialRatingHtml}
                </div>

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
                    <p id="modal-overview-text" class="text-gray-300 mb-4 text-sm" data-overview-english="${(movie.overviewEnglish || movie.overview || 'No description available.').replace(/"/g, '&quot;')}" data-overview-original="${(movie.overviewOriginal || movie.overview || '').replace(/"/g, '&quot;')}">${movie.overview || 'No description available.'}</p>
                </div>

                <div class="mb-4">
                    <h4 class="font-semibold text-white text-sm">${directorLabel}</h4>
                    <p class="text-gray-400 text-sm">${director ? director.name : 'N/A'}</p>
                </div>

                <div>
                    <h4 class="font-semibold text-white text-sm">Cast</h4>
                    <div id="modal-cast-list" class="flex flex-wrap gap-2 mt-1">
                        ${cast.map(a => `<a href="#" class="actor-link text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full px-3 py-1 transition-colors" data-actor-id="${a.id}" data-actor-name="${a.name}">${a.name}</a>`).join('')}
                    </div>
                </div>

                <!-- Controls -->
                <div class="mt-4 mb-2">
                    <div class="flex items-start justify-between gap-6 mb-3">
                        <div class="flex items-center gap-3">
                            <div class="text-sm text-gray-300">Status:</div>
                            <select id="modal-status-select" class="text-sm bg-gray-700 text-white px-2 py-1 rounded">
                                <option value="">Not set</option>
                                <option value="watching" ${currentStatus === 'watching' ? 'selected' : ''}>Watching</option>
                                <option value="watched" ${currentStatus === 'watched' ? 'selected' : ''}>Watched</option>
                                <option value="planning" ${currentStatus === 'planning' ? 'selected' : ''}>Planning</option>
                                <option value="dropped" ${currentStatus === 'dropped' ? 'selected' : ''}>Dropped</option>
                            </select>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <div class="flex items-center gap-3">
                                <div class="text-sm text-gray-300">Rating:</div>
                                ${ratingHtml}
                                <div class="relative">
                                    <button type="button" id="modal-add-to-list-btn" class="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-md text-sm">${movieInfo && (movieInfo.status || movieInfo.rating) ? 'Remove from list' : 'Add to List'}</button>
                                    <div id="modal-add-popover" class="hidden absolute right-0 mt-2 w-44 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 text-sm">
                                        <button type="button" class="w-full text-left px-3 py-2 hover:bg-gray-700 modal-list-option" data-status="watching">Watching</button>
                                        <button type="button" class="w-full text-left px-3 py-2 hover:bg-gray-700 modal-list-option" data-status="watched">Watched</button>
                                        <button type="button" class="w-full text-left px-3 py-2 hover:bg-gray-700 modal-list-option" data-status="planning">Planned</button>
                                    </div>
                                </div>
                            </div>
                            <!-- Series progress - aligned with rating on the right -->
                            ${seriesProgressHtml}
                        </div>
                    </div>
                </div>

                <!-- Watch progress for movies -->
                ${watchProgressHtml}
            </div>

            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
                <div class="text-sm text-gray-300">Last updated: <span class="text-gray-400 text-sm">${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span></div>
                <div></div>
            </div>
        </div>
    `;
}