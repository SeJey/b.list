/**
 * Search Results Page Logic
 * Handles searching and displaying movies/series search results
 */

import { fetchTMDb } from '../../api/tmdb.js';
// TVDB search is kept as a reference while series run through TMDb.
// import { searchTVSeries } from '../../api/tvdb.js';
import { normalizeMediaItem } from '../../utils/mediaData.js';
import { renderMediaLoading, renderMovieGrid, showNotification } from '../ui.js';

export async function loadSearchResultsPage(query, elements) {
  const { searchPageTitle, searchPageInput, searchResultsGrid, searchEmptyState, loader } = elements;

  if (!query.trim()) {
    if (searchEmptyState) searchEmptyState.classList.remove('hidden');
    if (searchResultsGrid) searchResultsGrid.innerHTML = '';
    return;
  }

  // Update the page title and input
  if (searchPageTitle) searchPageTitle.textContent = `Search Results for "${query}"`;
  if (searchPageInput) searchPageInput.value = query;

  if (loader) loader.classList.remove('hidden');
  renderMediaLoading(searchResultsGrid, 12);

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

    // Combine results - movies first, then series
    const combined = [...movies, ...series];
    if (loader) loader.classList.add('hidden');

    if (combined.length === 0) {
      if (searchResultsGrid) searchResultsGrid.innerHTML = '';
      if (searchEmptyState) searchEmptyState.classList.remove('hidden');
    } else {
      if (searchEmptyState) searchEmptyState.classList.add('hidden');
      renderMovieGrid(searchResultsGrid, combined, { backPage: 'search' });
    }
  } catch (err) {
    console.error('Search failed:', err);
    if (loader) loader.classList.add('hidden');
    if (searchEmptyState) searchEmptyState.classList.remove('hidden');
    if (searchResultsGrid) searchResultsGrid.innerHTML = '';
    showNotification('Search failed. Please try again.', true);
  }
}
