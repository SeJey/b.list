/**
 * Recommendations and Playlists Page Logic
 * Handles loading recommendations, playlists, and genre grid
 */

import { fetchTMDb } from '../../api/tmdb.js';
// TVDB search is kept as a reference while playlist database search uses TMDb.
// import { searchTVSeries } from '../../api/tvdb.js';
import { subscribeToUserPlaylists, deletePlaylist, addMovieToPlaylist, removeMovieFromPlaylist } from '../../storage.js';
import { normalizeMediaItem } from '../../utils/mediaData.js';
import { getGenreScores, scoreMovie } from '../../utils/recommendations.js';
import { escapeHtml } from '../../utils/helpers.js';
import { renderMovieGrid, showNotification } from '../ui.js';

let playlistsUnsubscribe = null;
let latestPlaylists = [];
let activePlaylistId = null;

export async function loadRecommendationsPage(userMovieList, myListPageMovies, elements, currentUser, APP_ID) {
  const { userPlaylistsSection, aiRecommendationsContainer, aiRecommendationsGrid, recommendationsEmptyState } = elements;
  
  // Load genre grid
  await loadGenreGrid(elements);
  
  // Show/hide sections based on auth
  if (currentUser) {
    if (userPlaylistsSection) userPlaylistsSection.classList.remove('hidden');
    if (aiRecommendationsContainer) aiRecommendationsContainer.classList.remove('hidden');
    await loadUserPlaylists(APP_ID, currentUser.uid, elements, userMovieList);
  } else {
    if (userPlaylistsSection) userPlaylistsSection.classList.add('hidden');
    if (aiRecommendationsContainer) aiRecommendationsContainer.classList.add('hidden');
  }
  
  // Initialize recommendations grid (empty initially)
  if (aiRecommendationsGrid) {
    aiRecommendationsGrid.innerHTML = '';
  }
  if (recommendationsEmptyState) {
    recommendationsEmptyState.classList.remove('hidden');
  }
}
export async function loadGenreGrid(elements) {
  const { genreGrid, loader } = elements;
  
  if (!genreGrid) return;
  
  if (loader) loader.classList.remove('hidden');
  
  try {
    const genresData = await fetchTMDb('/genre/movie/list');
    const genres = genresData.genres || [];
    
    genreGrid.innerHTML = genres.map(genre => `
      <div class="genre-card bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-lg cursor-pointer hover:shadow-lg hover:shadow-blue-500/50 transition-all border border-gray-700 hover:border-blue-500" data-genre-id="${genre.id}" data-genre-name="${genre.name}">
        <h3 class="text-lg font-bold text-white text-center">${genre.name}</h3>
      </div>
    `).join('');
    
    genreGrid.querySelectorAll('.genre-card').forEach(card => {
      card.addEventListener('click', () => {
        const genreId = card.dataset.genreId;
        const genreName = card.dataset.genreName;
        document.dispatchEvent(new CustomEvent('selectGenre', {
          detail: { genreId, genreName }
        }));
      });
    });
  } catch (error) {
    console.error('Error loading genre grid:', error);
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}
export async function loadUserPlaylists(APP_ID, userId, elements, userMovieList = new Map()) {
  const { userPlaylistsGrid, playlistsGrid } = elements;
  
  if (!userPlaylistsGrid && !playlistsGrid) return;
  
  if (playlistsUnsubscribe) {
    playlistsUnsubscribe();
  }
  
  playlistsUnsubscribe = subscribeToUserPlaylists(APP_ID, userId, (playlists) => {
    latestPlaylists = playlists;
    renderUserPlaylistsCards(playlists, userPlaylistsGrid, elements.userPlaylistsEmpty, { APP_ID, userId, elements, userMovieList });
    if (activePlaylistId && playlistsGrid) {
      openPlaylistView(activePlaylistId, { APP_ID, userId, elements, userMovieList });
    } else {
      renderUserPlaylistsCards(playlists, playlistsGrid, elements.playlistsEmpty, { APP_ID, userId, elements, userMovieList });
    }
  });
  
  return playlistsUnsubscribe;
}

function renderUserPlaylistsCards(playlists, userPlaylistsGrid, emptyState, context = {}) {
  if (!userPlaylistsGrid) return;
  
  if (playlists.length === 0) {
    userPlaylistsGrid.innerHTML = '';
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');
  
  userPlaylistsGrid.innerHTML = playlists.map(playlist => `
    <div class="playlist-card bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-purple-500 transition-all cursor-pointer" data-playlist-id="${escapeHtml(playlist.id)}">
      <div class="flex items-start justify-between mb-2">
        <h3 class="text-lg font-bold truncate flex-1">${escapeHtml(playlist.name)}</h3>
        <button type="button" class="delete-playlist-btn text-gray-400 hover:text-red-500 ml-2" aria-label="Delete playlist" data-playlist-id="${escapeHtml(playlist.id)}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
      ${playlist.description ? `<p class="text-sm text-gray-400 mb-2 line-clamp-2">${escapeHtml(playlist.description)}</p>` : ''}
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-500">${playlist.movieIds?.length || 0} movies</span>
        ${playlist.isPublic ? '<span class="text-green-400 text-xs">Public</span>' : '<span class="text-gray-500 text-xs">Private</span>'}
      </div>
    </div>
  `).join('');
  
  // Add event listeners
  userPlaylistsGrid.querySelectorAll('.playlist-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.delete-playlist-btn')) {
        const playlistId = card.dataset.playlistId;
        openPlaylistView(playlistId, context);
      }
    });
  });

  userPlaylistsGrid.querySelectorAll('.delete-playlist-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const playlistId = button.dataset.playlistId;
      if (!playlistId || !context.APP_ID || !context.userId) return;
      const confirmed = window.confirm('Delete this playlist? This cannot be undone.');
      if (!confirmed) return;

      try {
        await deletePlaylist(context.APP_ID, context.userId, playlistId);
        if (activePlaylistId === playlistId) activePlaylistId = null;
        showNotification('Playlist deleted.', false);
      } catch (error) {
        console.error('Delete playlist failed:', error);
        showNotification('Could not delete playlist.', true);
      }
    });
  });
}

function getMediaDataFromListItem(id, item) {
  return {
    id: String(id),
    title: item?.title || item?.name || 'Untitled',
    poster_path: item?.poster_path || item?.image || '',
    release_date: item?.release_date || item?.first_air_date || '',
    media_type: item?.media_type || item?.type || 'movie',
    type: item?.type || item?.media_type || 'movie',
    status: item?.status || ''
  };
}

function getPlaylistMediaItems(userMovieList, playlist) {
  const playlistItems = Array.isArray(playlist.movieIds) ? playlist.movieIds.map(id => String(id)) : [];
  const playlistMediaItems = playlist.mediaItems || {};
  return playlistItems.map(movieId => {
    const savedItem = userMovieList.get(movieId);
    if (savedItem) return getMediaDataFromListItem(movieId, savedItem);
    const playlistItem = playlistMediaItems[movieId] || {};
    return {
      id: movieId,
      title: playlistItem.title || playlistItem.name || movieId,
      poster_path: playlistItem.poster_path || playlistItem.image || '',
      release_date: playlistItem.release_date || playlistItem.first_air_date || '',
      media_type: playlistItem.media_type || playlistItem.type || 'movie',
      type: playlistItem.type || playlistItem.media_type || 'movie',
      status: ''
    };
  });
}

function searchMyListItems(userMovieList, playlistItems, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const selectedIds = new Set(playlistItems.map(id => String(id)));
  return Array.from(userMovieList.entries())
    .map(([id, item]) => getMediaDataFromListItem(id, item))
    .filter(item => !selectedIds.has(item.id))
    .filter(item => item.title.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function getPosterUrl(item) {
  if (!item?.poster_path) return 'https://placehold.co/90x135/374151/e5e7eb?text=No+Image';
  if (String(item.poster_path).startsWith('http')) return item.poster_path;
  if (String(item.id || '').startsWith('tvdb_')) {
    const path = String(item.poster_path).startsWith('/') ? item.poster_path : `/${item.poster_path}`;
    return `https://artworks.thetvdb.com/banners${path}`;
  }
  return `https://image.tmdb.org/t/p/w342${item.poster_path}`;
}

function openPlaylistView(playlistId, context = {}) {
  const playlist = latestPlaylists.find(item => String(item.id) === String(playlistId));
  if (!playlist) {
    showNotification('Could not open playlist.', true);
    return;
  }

  const playlistsPage = document.getElementById('playlists-page');
  const playlistsGrid = document.getElementById('playlists-grid');
  const playlistsEmpty = document.getElementById('playlists-empty');
  if (!playlistsPage || !playlistsGrid) {
    showNotification('Could not open playlist.', true);
    return;
  }

  activePlaylistId = String(playlistId);
  if (playlistsPage.classList.contains('hidden')) {
    document.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'playlists' } }));
  }

  const playlistItems = Array.isArray(playlist.movieIds) ? playlist.movieIds : [];
  const userMovieList = context.userMovieList || new Map();
  const mediaItems = getPlaylistMediaItems(userMovieList, playlist);

  playlistsEmpty?.classList.add('hidden');
  playlistsGrid.innerHTML = `
    <div class="col-span-full">
      <button type="button" id="back-to-playlists-btn" class="mb-5 text-sm text-sky-400 hover:text-sky-300 transition-colors">
        Back to playlists
      </button>
      <div class="border border-gray-700 bg-gray-800 rounded-lg p-5 mb-5">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold text-white">${escapeHtml(playlist.name || 'Untitled Playlist')}</h2>
            ${playlist.description ? `<p class="text-gray-400 mt-2">${escapeHtml(playlist.description)}</p>` : ''}
          </div>
          <span class="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 self-start">
            ${playlist.isPublic ? 'Public' : 'Private'}
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-4">${playlistItems.length} ${playlistItems.length === 1 ? 'movie' : 'movies'}</p>
      </div>

      <div class="grid md:grid-cols-2 gap-4 mb-5">
        <div class="border border-gray-700 bg-gray-800 rounded-lg p-4">
          <label for="playlist-my-list-search" class="block text-sm text-gray-300 mb-2">Search My List</label>
          <input id="playlist-my-list-search" type="search" class="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm" placeholder="Search saved titles...">
          <div id="playlist-my-list-results" class="mt-3 space-y-2"></div>
        </div>
        <form id="playlist-db-search-form" class="border border-gray-700 bg-gray-800 rounded-lg p-4">
          <label for="playlist-db-search" class="block text-sm text-gray-300 mb-2">Search Databases</label>
          <div class="flex gap-2">
            <input id="playlist-db-search" type="search" class="flex-1 bg-gray-700 text-white rounded px-3 py-2 text-sm" placeholder="Search movies and TV series...">
            <button type="submit" class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded text-sm">Search</button>
          </div>
          <div id="playlist-db-results" class="mt-3 space-y-2"></div>
        </form>
      </div>

      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold text-white">Playlist Items</h3>
        </div>
        ${mediaItems.length
          ? `<div class="space-y-3">
              ${mediaItems.map(item => `
                <div class="flex items-center gap-3 bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <img src="${getPosterUrl(item)}" alt="${escapeHtml(item.title)} poster" class="w-12 h-16 rounded object-cover flex-shrink-0" onerror="this.src='https://placehold.co/90x135/374151/e5e7eb?text=No+Image'">
                  <div class="min-w-0 flex-1">
                    <p class="text-white font-medium truncate">${escapeHtml(item.title)}</p>
                    ${item.status ? `<p class="text-xs text-gray-400 mt-1">${escapeHtml(item.status)}</p>` : ''}
                  </div>
                  <button type="button" class="playlist-remove-item-btn text-sm text-red-400 hover:text-red-300 px-2 py-1" data-movie-id="${escapeHtml(item.id)}">
                    Remove
                  </button>
                </div>
              `).join('')}
            </div>`
          : `<div class="text-center py-12 border border-dashed border-gray-700 rounded-lg">
              <p class="text-gray-400 text-lg">This playlist is empty.</p>
              <p class="text-gray-500 mt-2">Search your list or the movie database above to add titles.</p>
            </div>`
        }
      </div>
    </div>
  `;

  document.getElementById('back-to-playlists-btn')?.addEventListener('click', () => {
    activePlaylistId = null;
    renderUserPlaylistsCards(latestPlaylists, playlistsGrid, playlistsEmpty, context);
  });

  const myListSearchInput = document.getElementById('playlist-my-list-search');
  const myListResults = document.getElementById('playlist-my-list-results');
  const databaseSearchForm = document.getElementById('playlist-db-search-form');
  const databaseSearchInput = document.getElementById('playlist-db-search');
  const databaseResults = document.getElementById('playlist-db-results');
  let currentDatabaseResults = [];

  const renderSearchRows = (container, items, emptyMessage, buttonClass) => {
    if (!container) return;
    if (!items.length) {
      container.innerHTML = `<p class="text-sm text-gray-500">${emptyMessage}</p>`;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="flex items-center gap-3 rounded border border-gray-700 bg-gray-900/40 p-2">
        <img src="${getPosterUrl(item)}" alt="${escapeHtml(item.title)} poster" class="w-10 h-14 rounded object-cover flex-shrink-0" onerror="this.src='https://placehold.co/90x135/374151/e5e7eb?text=No+Image'">
        <div class="min-w-0 flex-1">
          <p class="text-sm text-white truncate">${escapeHtml(item.title)}</p>
          <p class="text-xs text-gray-500">
            ${escapeHtml(item.media_type === 'tv' || item.type === 'series' ? 'TV Series' : 'Movie')}
            ${item.release_date ? ` - ${escapeHtml(String(item.release_date).slice(0, 4))}` : ''}
          </p>
        </div>
        <button type="button" class="${buttonClass} bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded text-xs" data-movie-id="${escapeHtml(item.id)}">
          Add
        </button>
      </div>
    `).join('');
  };

  const renderMyListSearch = () => {
    const query = myListSearchInput?.value || '';
    const results = searchMyListItems(userMovieList, playlistItems, query).slice(0, 8);
    renderSearchRows(
      myListResults,
      results,
      query.trim() ? 'No saved titles found.' : 'Type to search your saved titles.',
      'playlist-add-my-list-btn'
    );
  };

  myListSearchInput?.addEventListener('input', renderMyListSearch);
  renderMyListSearch();

  myListResults?.addEventListener('click', async (event) => {
    const button = event.target.closest('.playlist-add-my-list-btn');
    if (!button) return;

    const movieId = button.dataset.movieId;
    const item = getMediaDataFromListItem(movieId, userMovieList.get(movieId));
    try {
      await addMovieToPlaylist(context.APP_ID, context.userId, playlist.id, movieId, item);
      showNotification('Added to playlist.', false);
    } catch (error) {
      console.error('Add playlist item failed:', error);
      showNotification('Could not add to playlist.', true);
    }
  });

  databaseSearchForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = databaseSearchInput?.value?.trim() || '';
    if (!query) {
      renderSearchRows(databaseResults, [], 'Type a title to search movies and TV series.', 'playlist-add-db-btn');
      return;
    }

    if (databaseResults) {
      databaseResults.innerHTML = '<p class="text-sm text-gray-500">Searching...</p>';
    }

    try {
      const [movieData, seriesData] = await Promise.all([
        fetchTMDb('/search/movie', `query=${encodeURIComponent(query)}`).catch(error => {
          console.error('TMDb playlist search failed:', error);
          return { results: [] };
        }),
        fetchTMDb('/search/tv', `query=${encodeURIComponent(query)}&language=en-US`).catch(error => {
          console.error('TMDb TV playlist search failed:', error);
          return { results: [] };
        })
        // Previous TVDB path:
        // searchTVSeries(query).catch(error => {
        //   console.error('TVDB playlist search failed:', error);
        //   return [];
        // })
      ]);
      const selectedIds = new Set(playlistItems.map(id => String(id)));

      const movieResults = (movieData.results || [])
        .map(movie => normalizeMediaItem(movie, 'movie'))
        .filter(movie => !selectedIds.has(movie.dbId))
        .map(movie => ({
          id: movie.dbId,
          title: movie.title || movie.name || 'Untitled',
          poster_path: movie.poster_path || '',
          release_date: movie.release_date || '',
          media_type: 'movie',
          type: 'movie'
        }));

      const seriesResults = (seriesData.results || [])
        .map(series => normalizeMediaItem(series, 'series'))
        .filter(series => !selectedIds.has(series.dbId))
        .map(series => ({
          id: series.dbId,
          title: series.title || series.name || 'Untitled',
          poster_path: series.poster_path || series.image || '',
          release_date: series.release_date || series.first_air_date || '',
          media_type: 'tv',
          type: 'series'
        }));

      currentDatabaseResults = [...movieResults, ...seriesResults]
        .sort((a, b) => a.title.localeCompare(b.title))
        .slice(0, 10);

      renderSearchRows(databaseResults, currentDatabaseResults, 'No database results found.', 'playlist-add-db-btn');
    } catch (error) {
      console.error('Playlist database search failed:', error);
      if (databaseResults) {
        databaseResults.innerHTML = '<p class="text-sm text-red-400">Could not search the database.</p>';
      }
    }
  });

  databaseResults?.addEventListener('click', async (event) => {
    const button = event.target.closest('.playlist-add-db-btn');
    if (!button) return;

    const movieId = button.dataset.movieId;
    const item = currentDatabaseResults.find(result => result.id === movieId);
    if (!item) return;

    try {
      await addMovieToPlaylist(context.APP_ID, context.userId, playlist.id, movieId, item);
      showNotification('Added to playlist.', false);
    } catch (error) {
      console.error('Add database playlist item failed:', error);
      showNotification('Could not add to playlist.', true);
    }
  });

  playlistsGrid.querySelectorAll('.playlist-remove-item-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const movieId = button.dataset.movieId;
      if (!movieId) return;

      try {
        await removeMovieFromPlaylist(context.APP_ID, context.userId, playlist.id, movieId);
        showNotification('Removed from playlist.', false);
      } catch (error) {
        console.error('Remove playlist item failed:', error);
        showNotification('Could not remove from playlist.', true);
      }
    });
  });
}

export async function generateAlgorithmRecommendations(myListPageMovies, userMovieList, elements, availableMoviesForRecommendation = []) {
  const { aiRecommendationsGrid, recommendationsEmptyState, aiRecommendationsBtn, loader } = elements;
  
  const watchedMovies = myListPageMovies.filter(movie => 
    userMovieList.get(movie.dbId || String(movie.id))?.status === 'watched'
  );
  
  if (watchedMovies.length < 3) {
    showNotification('Add at least 3 movies to your "Watched" list for better recommendations.', false);
    return;
  }
  
  if (aiRecommendationsBtn) {
    aiRecommendationsBtn.disabled = true;
    aiRecommendationsBtn.textContent = '🔄 Generating...';
  }
  
  try {
    // Load available movies from cache or fetch
    let availableMovies = [...availableMoviesForRecommendation];
    if (availableMovies.length === 0) {
      const trendingMoviesWeek = await fetchTMDb('/trending/movie/week').catch(() => ({ results: [] }));
      const trendingMoviesDay = await fetchTMDb('/trending/movie/day').catch(() => ({ results: [] }));
      
      const weekMovies = (trendingMoviesWeek.results || []).map(movie => normalizeMediaItem(movie, 'movie'));
      const dayMovies = (trendingMoviesDay.results || []).map(movie => normalizeMediaItem(movie, 'movie'));
      
      availableMovies = [...weekMovies, ...dayMovies];
    }
    
    // Get genre scores and score all movies
    const genreScores = getGenreScores(watchedMovies);
    const watchedIds = new Set(watchedMovies.map(m => m.dbId || m.id));
    
    const movieScores = availableMovies.map(movie => ({
      movie,
      score: scoreMovie(movie, genreScores, watchedIds)
    })).filter(item => item.score > 0);
    
    // Get top 6 recommendations
    const topRecommendations = movieScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(item => item.movie);
    
    if (topRecommendations.length === 0) {
      showNotification('No new recommendations available. Try adding more movies!');
      if (recommendationsEmptyState) recommendationsEmptyState.classList.remove('hidden');
      if (aiRecommendationsGrid) aiRecommendationsGrid.innerHTML = '';
    } else {
      if (recommendationsEmptyState) recommendationsEmptyState.classList.add('hidden');
      renderMovieGrid(aiRecommendationsGrid, topRecommendations);
    }
  } catch (e) {
    console.error('Recommendation algorithm error:', e);
    showNotification('Could not generate recommendations. Please try again.');
  } finally {
    if (aiRecommendationsBtn) {
      aiRecommendationsBtn.disabled = false;
      aiRecommendationsBtn.textContent = '🔄 Generate Recommendations';
    }
  }
}
