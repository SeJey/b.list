/**
 * My List Page Logic
 * Handles loading, rendering, and filtering user's movie list
 */

import { fetchTMDb } from '../../api/tmdb.js';
// TVDB details fetch is parked while active series details use TMDb.
// import { getSeriesDetails } from '../../api/tvdb.js';
import { normalizeMediaItem } from '../../utils/mediaData.js';
import { renderMovieGrid, renderMovieListView } from '../ui.js';

export async function loadMyListPage(userMovieList, myListPageMovies, elements, currentUser) {
  const { myListGrid, myListFilters, myListSortRatingBtn, loader } = elements;
  const activeFilter = myListFilters?.querySelector('.filter-btn.active')?.dataset.status || 'all';
  const activeSortMode = myListSortRatingBtn?.dataset.sortMode || 'added';
  
  const mediaEntries = Array.from(userMovieList.entries());
  if (mediaEntries.length === 0) {
    myListPageMovies.length = 0;
    renderMovieListView(myListGrid, [], userMovieList, { showStatus: true, sortMode: activeSortMode });
    renderMyListFilters(myListFilters, activeFilter);
    updateMyListSortButton(myListSortRatingBtn, activeSortMode);
    return;
  }
  
  myListGrid.innerHTML = '';
  if (loader) loader.classList.remove('hidden');
  
  // Fetch movies and series from appropriate APIs
  const mediaPromises = mediaEntries.map(async ([id, savedItem]) => {
    try {
      const idValue = String(id);
      const isSeries = idValue.startsWith('tmdb_tv_') || idValue.startsWith('tvdb_') || savedItem?.type === 'series' || savedItem?.media_type === 'tv';

      if (isSeries) {
        if (idValue.startsWith('tvdb_')) {
          // Previous TVDB path:
          // const series = await getSeriesDetails(idValue.replace('tvdb_', ''));
          // if (!series) return null;
          return normalizeMediaItem(savedItem, 'series');
        }
        const seriesId = idValue.replace('tmdb_tv_', '').replace('tmdb_', '');
        const series = await fetchTMDb(`/tv/${seriesId}`, 'language=en-US');
        if (!series) return null;
        return normalizeMediaItem(series, 'series');
      } else {
        const movieId = idValue.replace('tmdb_', '');
        const movie = await fetchTMDb(`/movie/${movieId}`);
        if (!movie) return null;
        return normalizeMediaItem(movie, 'movie');
      }
    } catch (e) {
      console.error(`Failed to fetch media ${id}:`, e);
      return null;
    }
  });
  
  const mediaItems = await Promise.all(mediaPromises);
  if (loader) loader.classList.add('hidden');
  
  myListPageMovies.length = 0;
  myListPageMovies.push(...mediaItems.filter(Boolean));
  
  renderMyListFilters(myListFilters, activeFilter);
  updateMyListSortButton(myListSortRatingBtn, activeSortMode);
  filterMyList(activeFilter, myListPageMovies, userMovieList, myListGrid, activeSortMode);
}

export function renderMyListFilters(myListFilters, activeStatus = 'all') {
  myListFilters.innerHTML = `
    <button type="button" class="filter-btn ${activeStatus === 'all' ? 'active' : ''}" data-status="all">All</button>
    <button type="button" class="filter-btn ${activeStatus === 'watched' ? 'active' : ''}" data-status="watched">Watched</button>
    <button type="button" class="filter-btn ${activeStatus === 'watching' ? 'active' : ''}" data-status="watching">Watching</button>
    <button type="button" class="filter-btn ${activeStatus === 'planning' ? 'active' : ''}" data-status="planning">Planning</button>
    <button type="button" class="filter-btn ${activeStatus === 'dropped' ? 'active' : ''}" data-status="dropped">Dropped</button>
  `;
  
  myListFilters.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      myListFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.dispatchEvent(new CustomEvent('filterMyList', {
        detail: { status: btn.dataset.status }
      }));
    };
  });
}

export function updateMyListSortButton(button, sortMode = 'added') {
  if (!button) return;
  const isRatingSort = sortMode === 'rating';
  button.dataset.sortMode = sortMode;
  button.classList.toggle('bg-sky-600', isRatingSort);
  button.classList.toggle('text-white', isRatingSort);
  button.classList.toggle('bg-gray-700', !isRatingSort);
  button.classList.toggle('text-gray-200', !isRatingSort);
  button.textContent = isRatingSort ? 'Sorted by Rating' : 'Sort by Rating';
}

export function filterMyList(status, myListPageMovies, userMovieList, myListGrid, sortMode = 'added') {
  let moviesToRender = myListPageMovies;
  
  if (status !== 'all') {
    moviesToRender = myListPageMovies.filter(
      movie => (userMovieList.get(movie.dbId || String(movie.id)) || userMovieList.get(String(movie.id)))?.status === status
    );
  }
  
  renderMovieListView(myListGrid, moviesToRender, userMovieList, { showStatus: true, sortMode });
}
