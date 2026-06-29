/**
 * Browse Pages Logic
 * Handles loading and filtering for both movies and TV series browsing
 */

import { fetchTMDb } from '../../api/tmdb.js';
// TVDB browse/search is kept as a reference while series run through TMDb.
// import { searchTVSeries, getSeriesFilter } from '../../api/tvdb.js';
import { normalizeMediaItem } from '../../utils/mediaData.js';
import {
  populateMovieDropdowns,
  populateSeriesDropdowns,
  filterSeriesByNetworks,
  getExpandedMovieFilters,
  getExpandedSeriesFilters,
  renderSeriesTagChips
} from '../components/filters.js';
import { renderMediaLoading, renderMediaMessage, renderMovieGrid, showNotification } from '../ui.js';

function normalizeTmdbCountry(value) {
  const code = String(value || '').toLowerCase();
  if (code === 'usa' || code === 'us') return 'US';
  return String(value || '').toUpperCase();
}

function normalizeTmdbLanguage(value) {
  const code = String(value || '').toLowerCase();
  if (code === 'eng') return 'en';
  return code.slice(0, 2) || 'en';
}

export async function loadBrowseMoviesPage(activeMovieFilters, elements) {
  const { movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown } = elements;
  
  // Populate dropdown options
  await populateMovieDropdowns(activeMovieFilters, movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown);
  await loadMovieBrowseResults(activeMovieFilters, elements);
}

export async function loadMovieBrowseResults(activeMovieFilters, elements) {
  const { movieBrowseGrid, movieBrowseResultsTitle, movieRecommendationsSection, currentUser } = elements;
  
  if (!movieBrowseGrid) return;
  
  try {
    renderMediaLoading(movieBrowseGrid, 12);
    
    let data;
    const searchFilter = activeMovieFilters.find(f => f.type === 'search');
    const expandedMovieFilters = getExpandedMovieFilters(activeMovieFilters);

    if (searchFilter) {
      data = await fetchTMDb('/search/movie', `query=${encodeURIComponent(searchFilter.query)}`);
      if (movieBrowseResultsTitle) movieBrowseResultsTitle.textContent = searchFilter.name;
    } else if (activeMovieFilters.length === 0) {
      // Load trending as default
      data = await fetchTMDb('/trending/movie/week');
      if (movieBrowseResultsTitle) movieBrowseResultsTitle.textContent = 'Trending This Week';
    } else {
      // Build params from active filters
      let params = 'sort_by=popularity.desc';
      
      const genres = expandedMovieFilters.filter(f => f.type === 'genre').map(f => f.id);
      const keywords = expandedMovieFilters.filter(f => f.type === 'keyword').map(f => f.id);
      const certifications = expandedMovieFilters.filter(f => f.type === 'certification').map(f => f.id);
      
      if (genres.length > 0) {
        params += `&with_genres=${genres.join(',')}`;
      }
      if (keywords.length > 0) {
        params += `&with_keywords=${keywords.join(',')}`;
      }
      if (certifications.length > 0) {
        params += `&certification=${certifications[0]}&certification_country=US`;
      }
      
      data = await fetchTMDb('/discover/movie', params);
      
      if (movieBrowseResultsTitle) {
        const filterNames = activeMovieFilters.map(f => f.name).join(', ');
        movieBrowseResultsTitle.textContent = filterNames;
      }
    }
    
    const movies = (data.results || []).map(movie => normalizeMediaItem(movie, 'movie'));
    
    if (movies.length === 0) {
      renderMediaMessage(movieBrowseGrid, 'No films found', 'Try removing a filter or searching for a different title.');
    } else {
      renderMovieGrid(movieBrowseGrid, movies, { clickAction: 'page', backPage: 'browse-movies' });
    }
  } catch (error) {
    console.error('Error loading movie browse results:', error);
    renderMediaMessage(movieBrowseGrid, 'Films could not be loaded', 'Check your connection and try again.', true);
  }
}

export async function loadBrowseSeriesPage(activeSeriesFilters, elements) {
  const { seriesGenreDropdown, seriesStatusDropdown, seriesTagQuickPicks } = elements;
  
  // Populate dropdown options
  renderSeriesTagChips(activeSeriesFilters, seriesTagQuickPicks);
  await populateSeriesDropdowns(activeSeriesFilters, seriesGenreDropdown, null, seriesStatusDropdown, null, null);
  await loadSeriesBrowseResults(activeSeriesFilters, elements);
}

export async function loadSeriesBrowseResults(activeSeriesFilters, elements) {
  const { seriesBrowseGrid, seriesBrowseResultsTitle } = elements;
  
  if (!seriesBrowseGrid) return;

  try {
    renderMediaLoading(seriesBrowseGrid, 12);

    const searchFilter = activeSeriesFilters.find(f => f.type === 'search');
    const expandedSeriesFilters = getExpandedSeriesFilters(activeSeriesFilters);
    const genreFilter = expandedSeriesFilters.find(f => f.type === 'genre' && Number.isFinite(Number(f.id)));
    const statusFilter = expandedSeriesFilters.find(f => f.type === 'status');
    const countryFilter = expandedSeriesFilters.find(f => f.type === 'country');
    const languageFilter = expandedSeriesFilters.find(f => f.type === 'language');
    const keywords = expandedSeriesFilters.filter(f => f.type === 'keyword').map(f => f.id);
    const networkFilters = expandedSeriesFilters.filter(f => f.type === 'network').map(f => f.name);

    let results = [];
    const selectedSeriesCountry = normalizeTmdbCountry(countryFilter?.id || 'US');
    const selectedSeriesLanguage = normalizeTmdbLanguage(languageFilter?.id || 'en');

    if (searchFilter) {
      const data = await fetchTMDb('/search/tv', `query=${encodeURIComponent(searchFilter.query)}&language=en-US`);
      results = data.results || [];
      // Previous TVDB path:
      // results = await searchTVSeries(searchFilter.query);
      if (seriesBrowseResultsTitle) seriesBrowseResultsTitle.textContent = searchFilter.name;
    } else {
      let params = `sort_by=popularity.desc&language=en-US&page=1`;
      if (selectedSeriesCountry) params += `&with_origin_country=${encodeURIComponent(selectedSeriesCountry)}`;
      if (selectedSeriesLanguage) params += `&with_original_language=${encodeURIComponent(selectedSeriesLanguage)}`;
      if (genreFilter) params += `&with_genres=${encodeURIComponent(genreFilter.id)}`;
      if (keywords.length > 0) {
        params += `&with_keywords=${keywords.map(id => encodeURIComponent(id)).join(',')}`;
      }
      if (statusFilter && Number.isFinite(Number(statusFilter.id))) {
        params += `&with_status=${encodeURIComponent(statusFilter.id)}`;
      }
      const data = await fetchTMDb('/discover/tv', params);
      results = data.results || [];
      // Previous TVDB path:
      // results = await getSeriesFilter(params);

      if (seriesBrowseResultsTitle) {
        seriesBrowseResultsTitle.textContent = activeSeriesFilters.length
          ? activeSeriesFilters.map(f => f.name).join(', ')
          : 'Popular Series';
      }
    }

    // Filter by networks if needed
    if (networkFilters.length > 0) {
      results = filterSeriesByNetworks(results, networkFilters);
    }

    // Normalize and render. TMDb TV results already have English title/overview fields.
    const normalized = results.map(s => normalizeMediaItem(s, 'series'));

    if (normalized.length === 0) {
      renderMediaMessage(seriesBrowseGrid, 'No series found', 'Try removing a filter or searching for a different title.');
    } else {
      renderMovieGrid(seriesBrowseGrid, normalized, { clickAction: 'page', backPage: 'browse-series' });
    }
  } catch (error) {
    console.error('Error loading series results:', error);
    renderMediaMessage(seriesBrowseGrid, 'Series could not be loaded', 'Check your connection and try again.', true);
  }
}
