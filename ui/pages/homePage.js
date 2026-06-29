/**
 * Home Page Logic
 * Handles loading and rendering home page content with carousels
 */

import { fetchTMDb } from '../../api/tmdb.js';
// TVDB search/filter is kept as a reference while series run through TMDb.
// import { searchTVSeries, getSeriesFilter } from '../../api/tvdb.js';
import { escapeAttribute, escapeHtml, getMovieProgress, getPosterUrl, getSeriesProgress } from '../../utils/helpers.js';
import { normalizeMediaItem } from '../../utils/mediaData.js';
import { renderCarousel, setupCarouselAutoScroll } from '../components/carousel.js';
import { renderMediaLoading, renderMediaMessage, renderMovieGrid, showNotification } from '../ui.js';

function renderFeaturedHero(elements, media) {
  const { featuredHero, featuredBackdrop, featuredTitle, featuredMeta, featuredOverview, featuredDetailsBtn, featuredWatchlistBtn } = elements;
  if (!featuredHero || !media) return;

  const title = media.title || media.name || 'Featured title';
  const date = media.release_date || media.first_air_date || '';
  const year = date ? String(date).slice(0, 4) : '';
  const rating = Number(media.vote_average || media.tmdbRating || 0);
  const mediaId = media.dbId || `tmdb_${media.id}`;
  const backdrop = media.backdrop_path
    ? `https://image.tmdb.org/t/p/original${media.backdrop_path}`
    : getPosterUrl(media);

  featuredHero.dataset.movieId = mediaId;
  featuredTitle.textContent = title;
  featuredOverview.textContent = media.overview || 'A standout story, selected from what audiences are watching this week.';
  featuredMeta.innerHTML = [year, rating > 0 ? `★ ${rating.toFixed(1)}` : '', 'Film']
    .filter(Boolean)
    .map(value => `<span>${escapeHtml(value)}</span>`)
    .join('');
  featuredBackdrop.src = backdrop;
  featuredBackdrop.alt = `${title} backdrop`;
  featuredHero.classList.remove('featured-hero-loading');
  featuredHero.classList.add('is-ready');

  featuredDetailsBtn.onclick = () => document.dispatchEvent(new CustomEvent('movieCardClick', { detail: { movieId: mediaId } }));
  featuredWatchlistBtn.onclick = () => document.dispatchEvent(new CustomEvent('addToListClick', { detail: { movieId: mediaId } }));
}

export async function loadHomePageContent(elements) {
  const { trendingCarousel, upcomingMoviesCarousel, homeGrid, topSeriesGrid, loader, upcomingMoviesPrev, upcomingMoviesNext, trendingPrev, trendingNext } = elements;
  
  // Clear existing content
  [trendingCarousel, upcomingMoviesCarousel, homeGrid, topSeriesGrid].forEach(container => renderMediaLoading(container, 7));
  if (loader) loader.classList.remove('hidden');

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch upcoming movies (multiple pages for more variety)
    let upcomingMoviesData = await Promise.all([
      fetchTMDb('/movie/upcoming', 'page=1&language=en-US'),
      fetchTMDb('/movie/upcoming', 'page=2&language=en-US')
    ]).then(results => {
      const allMovies = [...(results[0]?.results || []), ...(results[1]?.results || [])];
      return allMovies
        .filter(movie => {
          const releaseDate = movie.release_date;
          return releaseDate && new Date(releaseDate) > new Date(today);
        })
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    });
    
    const [trendingData, topMovies, topSeries] = await Promise.all([
      fetchTMDb('/trending/movie/week'),
      fetchTMDb('/movie/top_rated', 'page=1'),
      fetchTMDb('/tv/top_rated', 'page=1&language=en-US').catch(() => ({ results: [] }))
      // Previous TVDB path:
      // getSeriesFilter('country=usa&lang=eng&sort=rating&sortType=desc&page=0').catch(() => [])
    ]);

    // Process trending movies
    const trendingMoviesList = (trendingData.results || [])
      .slice(0, 20)
      .map(movie => {
        try {
          return normalizeMediaItem(movie, 'movie');
        } catch (e) {
          console.error('Error normalizing trending movie:', e);
          return null;
        }
      })
      .filter(Boolean);

    renderFeaturedHero(elements, trendingMoviesList[0]);
    
    // Process upcoming movies
    const upcomingMoviesList = (upcomingMoviesData || [])
      .slice(0, 20)
      .map(movie => {
        try {
          return normalizeMediaItem(movie, 'movie');
        } catch (e) {
          console.error('Error normalizing movie:', e);
          return null;
        }
      })
      .filter(Boolean);

    // Process top movies
    const topMoviesList = (topMovies.results || [])
      .slice(0, 30)
      .map(movie => {
        try {
          return normalizeMediaItem(movie, 'movie');
        } catch (e) {
          console.error('Error normalizing movie:', e);
          return null;
        }
      })
      .filter(Boolean);

    // Process top series
    const topSeriesList = (topSeries.results || [])
      .slice(0, 30)
      .map(series => {
        try {
          return normalizeMediaItem(series, 'series');
        } catch (e) {
          console.error('Error normalizing series:', e);
          return null;
        }
      })
      .filter(Boolean);

    // Render carousels
    renderCarousel(trendingCarousel, trendingMoviesList, 'trending', { variant: 'shelf' });
    renderCarousel(upcomingMoviesCarousel, upcomingMoviesList, 'upcoming-movies', { variant: 'shelf' });
    renderCarousel(homeGrid, topMoviesList, 'top-movies', { variant: 'shelf' });
    renderCarousel(topSeriesGrid, topSeriesList, 'top-series', { variant: 'shelf' });

    // Wire manual shelf controls (the retained function name is API compatibility).
    const carouselElements = {
      trending: { carousel: trendingCarousel, prev: trendingPrev, next: trendingNext },
      upcomingMovies: { carousel: upcomingMoviesCarousel, prev: upcomingMoviesPrev, next: upcomingMoviesNext },
      homeGrid: { carousel: homeGrid, prev: document.getElementById('top-movies-prev'), next: document.getElementById('top-movies-next') },
      topSeries: { carousel: topSeriesGrid, prev: document.getElementById('top-series-prev'), next: document.getElementById('top-series-next') }
    };
    
    setupCarouselAutoScroll('trending', trendingMoviesList.length, carouselElements);
    setupCarouselAutoScroll('upcoming-movies', upcomingMoviesList.length, carouselElements);
    setupCarouselAutoScroll('top-movies', topMoviesList.length, carouselElements);
    setupCarouselAutoScroll('top-series', topSeriesList.length, carouselElements);

  } catch (err) {
    console.error('Load home content error:', err);
    [trendingCarousel, upcomingMoviesCarousel, homeGrid, topSeriesGrid].forEach(container => {
      renderMediaMessage(container, 'This shelf is taking a break', 'We could not reach the catalogue. Please try again shortly.', true);
    });
    showNotification("Failed to load content.", true);
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}

export async function handleHomeSearch(query, elements) {
  const { homeGrid, upcomingMoviesCarousel, topSeriesGrid, loader } = elements;
  
  if (!query.trim()) {
    return;
  }
  
  // Hide carousels and show search results
  if (upcomingMoviesCarousel) upcomingMoviesCarousel.parentElement.parentElement.classList.add('hidden');
  if (topSeriesGrid) topSeriesGrid.parentElement.classList.add('hidden');
  if (homeGrid) homeGrid.parentElement.classList.remove('hidden');
  
  if (loader) loader.classList.remove('hidden');
  
  try {
    // Search both movies and TV series in parallel
    const [moviesRes, seriesRes] = await Promise.all([
      fetchTMDb('/search/movie', `query=${encodeURIComponent(query)}`).catch(() => ({ results: [] })),
      fetchTMDb('/search/tv', `query=${encodeURIComponent(query)}&language=en-US`).catch(() => ({ results: [] }))
      // Previous TVDB path:
      // searchTVSeries(query).catch(() => [])
    ]);
    
    // Normalize and combine results
    const movies = (moviesRes.results || []).map(m => {
      try {
        return normalizeMediaItem(m, 'movie');
      } catch (e) {
        console.error('Error normalizing movie:', e, m);
        return null;
      }
    }).filter(Boolean);
    
    const series = (seriesRes.results || []).map(s => {
      try {
        return normalizeMediaItem(s, 'series');
      } catch (e) {
        console.error('Error normalizing series:', e, s);
        return null;
      }
    }).filter(Boolean);
    
    // Mix results
    const combined = [...movies.slice(0, 15), ...series.slice(0, 15)];
    if (loader) loader.classList.add('hidden');
    renderMovieGrid(homeGrid, combined);
  } catch (err) {
    console.error('Search failed:', err);
    if (loader) loader.classList.add('hidden');
    showNotification('Search failed. Please try again.', true);
  }
}

export function createHomeController({
  state,
  elements,
  getPageElements,
  loadHomeActivityContent,
  updateMovieStatus
}) {
  function updateHomePageView() {
    elements.home.publicView?.classList.remove('hidden');
    elements.home.guestCta?.classList.toggle('hidden', Boolean(state.currentUser));
    void loadHomePageContent(getPageElements());
    if (state.currentUser) {
      elements.home.loggedInView?.classList.remove('hidden');
      void loadHomeActivityContent('activity');
      renderHomeInProgressSections();
    } else {
      elements.home.loggedInView?.classList.add('hidden');
    }
  }

  async function backfillMissingMovieRuntime() {
    if (state.homeRuntimeBackfillInProgress) return;

    const candidates = Array.from(state.userMovieList.entries())
      .filter(([id, item]) => {
        const isMovie = (String(id).startsWith('tmdb_') && !String(id).startsWith('tmdb_tv_')) || item?.type === 'movie' || item?.media_type === 'movie';
        const isWatching = item?.status === 'watching';
        const hasWatchTime = (Number(item?.watchTime) || 0) > 0;
        const hasRuntime = (Number(item?.runtime) || 0) > 0;
        return isMovie && isWatching && hasWatchTime && !hasRuntime;
      })
      .slice(0, 4);

    if (!candidates.length) return;

    state.homeRuntimeBackfillInProgress = true;
    let didUpdate = false;

    try {
      for (const [id, item] of candidates) {
        const tmdbId = String(id).replace('tmdb_', '');
        if (!tmdbId || !/^\d+$/.test(tmdbId)) continue;

        try {
          const details = await fetchTMDb(`/movie/${tmdbId}`);
          const runtime = Number(details?.runtime) || 0;
          if (runtime <= 0) continue;

          const updatedEntry = { ...item, runtime };
          state.userMovieList.set(String(id), updatedEntry);
          didUpdate = true;

          if (state.currentUser) {
            await updateMovieStatus(state.appId, state.currentUser.uid, id, updatedEntry);
          }
        } catch (err) {
          console.error('Runtime backfill failed for', id, err);
        }
      }
    } finally {
      state.homeRuntimeBackfillInProgress = false;
    }

    if (didUpdate && state.currentPage === 'home') {
      renderHomeInProgressSections();
    }
  }

  function renderHomeInProgressSections() {
    const moviesContainer = elements.home.moviesInProgress;
    const seriesContainer = elements.home.seriesInProgress;
    if (!moviesContainer || !seriesContainer) return;

    const inProgressEntries = Array.from(state.userMovieList.entries())
      .filter(([, item]) => item?.status === 'watching');

    const movieItems = inProgressEntries
      .filter(([id, item]) => item?.type === 'movie' || item?.media_type === 'movie' || (String(id).startsWith('tmdb_') && !String(id).startsWith('tmdb_tv_')))
      .map(([id, item]) => ({ ...item, dbId: String(id) }))
      .sort((a, b) => {
        const aProgress = getMovieProgress(a).score;
        const bProgress = getMovieProgress(b).score;
        if (bProgress !== aProgress) return bProgress - aProgress;
        return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
      })
      .slice(0, 8);

    const seriesItems = inProgressEntries
      .filter(([id, item]) => item?.type === 'series' || item?.media_type === 'tv' || String(id).startsWith('tmdb_tv_') || String(id).startsWith('tvdb_'))
      .map(([id, item]) => ({ ...item, dbId: String(id) }))
      .sort((a, b) => {
        const aProgress = getSeriesProgress(a).score;
        const bProgress = getSeriesProgress(b).score;
        if (bProgress !== aProgress) return bProgress - aProgress;
        return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
      })
      .slice(0, 8);

    moviesContainer.innerHTML = movieItems.length
      ? movieItems.map((movie) => {
          const posterUrl = getPosterUrl(movie);
          const progress = getMovieProgress(movie);
          return `
            <div class="home-progress-item relative group inline-block rounded-md border border-gray-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-sky-500 hover:shadow-lg hover:shadow-sky-900/30" data-movie-id="${escapeAttribute(movie.dbId)}">
                <img src="${escapeAttribute(posterUrl)}" alt="${escapeAttribute(movie.title || 'Movie poster')}" class="w-10 h-14 rounded object-cover border border-gray-600 transition-transform duration-200 group-hover:scale-105" onerror="this.src='https://placehold.co/90x135/374151/e5e7eb?text=No+Image'">
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-20 max-w-[240px] rounded-md border border-gray-700 bg-gray-900/95 px-2 py-2 text-xs text-white shadow-lg opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-normal break-words pointer-events-none">
                  <div class="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 rotate-45"></div>
                  <p class="font-medium">${escapeHtml(movie.title || 'Untitled movie')}</p>
                  <p class="text-gray-300 mt-1">${escapeHtml(progress.label)}</p>
                </div>
            </div>
          `;
        }).join('')
      : '<p class="text-sm text-gray-400">No movies in progress yet.</p>';

    seriesContainer.innerHTML = seriesItems.length
      ? seriesItems.map((series) => {
          const posterUrl = getPosterUrl(series);
          const progress = getSeriesProgress(series);
          return `
            <div class="home-progress-item relative group inline-block rounded-md border border-gray-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-sky-500 hover:shadow-lg hover:shadow-sky-900/30" data-movie-id="${escapeAttribute(series.dbId)}">
                <img src="${escapeAttribute(posterUrl)}" alt="${escapeAttribute(series.title || 'Series poster')}" class="w-10 h-14 rounded object-cover border border-gray-600 transition-transform duration-200 group-hover:scale-105" onerror="this.src='https://placehold.co/90x135/374151/e5e7eb?text=No+Image'">
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-20 max-w-[240px] rounded-md border border-gray-700 bg-gray-900/95 px-2 py-2 text-xs text-white shadow-lg opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-normal break-words pointer-events-none">
                  <div class="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 rotate-45"></div>
                  <p class="font-medium">${escapeHtml(series.title || 'Untitled series')}</p>
                  <p class="text-gray-300 mt-1">${escapeHtml(progress.label)}</p>
                </div>
            </div>
          `;
        }).join('')
      : '<p class="text-sm text-gray-400">No series in progress yet.</p>';

    void backfillMissingMovieRuntime();
  }

  return {
    updateHomePageView,
    renderHomeInProgressSections,
    backfillMissingMovieRuntime
  };
}
