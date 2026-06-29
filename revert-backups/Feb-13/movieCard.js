import { IMAGE_BASE_URL as TMDB_IMAGE_BASE_URL } from '../../api/tmdb.js';
import { IMAGE_BASE_URL as TVDB_IMAGE_BASE_URL } from '../../api/tvdb.js';

export function renderMovieCard(movie, options = {}) {
    const isMovie = movie.type === 'movie';
    const imageBaseUrl = isMovie ? TMDB_IMAGE_BASE_URL : TVDB_IMAGE_BASE_URL;
    
    // Handle poster path - TVDB might return full URLs or paths
    let posterPath;
    if (movie.poster_path) {
        if (movie.poster_path.startsWith('http')) {
            posterPath = movie.poster_path; // Already a full URL
        } else {
            posterPath = `${imageBaseUrl}${movie.poster_path}`;
        }
    } else {
        posterPath = 'https://placehold.co/500x750/1f2937/4b5563?text=No+Image';
    }
    
    const year = movie.release_date ? movie.release_date.split('-')[0] : (movie.first_air_date ? movie.first_air_date.split('-')[0] : 'N/A');
    const dbId = movie.dbId || (isMovie ? `tmdb_${movie.id}` : `tvdb_${movie.id}`);
    const typeLabel = isMovie ? 'MOVIE' : 'SERIES';
    const typeBgColor = isMovie ? 'bg-blue-600' : 'bg-purple-600';
    const tmdbRating = (typeof movie.tmdbRating === 'number' && movie.tmdbRating > 0) ? movie.tmdbRating : null;
    const tvdbRating = (typeof movie.tvdbRating === 'number' && movie.tvdbRating > 0) ? movie.tvdbRating : null;
    
    // Progress info for series
    let progressHtml = '';
    if (!isMovie && movie.currentSeason && movie.episodesWatched) {
        const currentEps = typeof movie.episodesWatched === 'object' ? (movie.episodesWatched[`s${movie.currentSeason}`] || 0) : 0;
        if (currentEps > 0) {
            progressHtml = ` <span class="mx-1">•</span> S${movie.currentSeason} • ${currentEps} eps`;
        }
    }

    let ratingsHtml = '';
    if (isMovie && tmdbRating) {
        ratingsHtml = `
            <div class="text-xs text-gray-300 px-1 mt-1">
                TMDb: ${tmdbRating.toFixed(1)}
            </div>
        `;
    } else if (!isMovie && tvdbRating) {
        ratingsHtml = `
            <div class="text-xs text-gray-300 px-1 mt-1">
                TVDB: ${tvdbRating.toFixed(1)}
            </div>
        `;
    }

    return `
        <div class="movie-card group cursor-pointer relative" data-movie-id="${dbId}">
            <div class="relative overflow-hidden rounded-lg">
                <img src="${posterPath}" alt="${movie.title}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300">
                <div class="absolute top-2 left-2 ${typeBgColor} text-white text-xs font-bold px-2 py-1 rounded">
                    ${typeLabel}
                </div>
                <button
                    type="button"
                    class="movie-add-btn absolute top-2 right-2 bg-green-600 hover:bg-green-700 text-white w-8 h-8 rounded-full shadow-lg transition-opacity opacity-0 group-hover:opacity-100 flex items-center justify-center text-2xl z-10"
                    aria-label="Add to List"
                    data-movie-id="${dbId}"
                    tabindex="0"
                >+</button>
            </div>
            <h3 class="text-sm font-semibold mt-2 truncate text-white px-1">${movie.title}</h3>
            <p class="text-xs text-gray-400 px-1">${year}${progressHtml}</p>
            ${ratingsHtml}
        </div>
    `;
}