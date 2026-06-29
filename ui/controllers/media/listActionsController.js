import { normalizeRatingForStorage } from '../../../utils/helpers.js';

export function createMediaListActionsController({
  state,
  elements,
  settings,
  switchPage,
  showNotification,
  updateMovieStatus,
  updateUserRating,
  updateWatchTime,
  updateEpisodesWatched,
  removeMovieFromList,
  removeAggregateRating,
  renderMyListFilters,
  filterMyList,
  publishActivity
}) {
  function compactPeople(people = [], limit = 12) {
    return (Array.isArray(people) ? people : []).filter(person => person?.name).slice(0, limit).map(person => ({
      id: person.id || person.name,
      name: person.name,
      profilePath: person.profilePath || person.profile_path || ''
    }));
  }

  function getAnalyticsMetadata(movieData = {}, current = {}) {
    const genres = (movieData.genres || current.genres || []).map(genre => typeof genre === 'string' ? { name: genre } : { id: genre.id || null, name: genre.name }).filter(genre => genre.name);
    const cast = compactPeople(movieData.cast || movieData.analytics?.cast || current.cast || current.analytics?.cast);
    const directors = compactPeople(movieData.directors || movieData.analytics?.directors || current.directors || current.analytics?.directors, 5);
    const mediaType = movieData.type === 'series' || movieData.media_type === 'tv' || current.type === 'series' || current.media_type === 'tv' ? 'series' : 'movie';
    return {
      genres,
      cast,
      directors,
      runtime: Number(movieData.runtime || current.runtime) || null,
      averageRuntime: Number(movieData.averageRuntime || movieData.episode_run_time?.[0] || current.averageRuntime) || null,
      numberOfEpisodes: Number(movieData.numberOfEpisodes || movieData.number_of_episodes || current.numberOfEpisodes) || null,
      mediaType
    };
  }

  function getStoredMediaFields(movieData = {}, current = {}) {
    const analytics = getAnalyticsMetadata(movieData, current);
    return {
      title: movieData.title || movieData.name || current.title || 'Untitled',
      poster_path: movieData.poster_path || current.poster_path || '',
      type: analytics.mediaType,
      media_type: analytics.mediaType === 'series' ? 'tv' : 'movie',
      genres: analytics.genres,
      cast: analytics.cast,
      directors: analytics.directors,
      runtime: analytics.runtime,
      averageRuntime: analytics.averageRuntime,
      numberOfEpisodes: analytics.numberOfEpisodes,
      analytics,
      analyticsVersion: 1
    };
  }

  function getEpisodeTotal(value) {
    if (value && typeof value === 'object') return Object.values(value).reduce((sum, count) => sum + (Number(count) || 0), 0);
    return Number(value) || 0;
  }
  function refreshMyListUI() {
    if (state.currentPage === 'my-list') {
      const activeFilter = document.querySelector('#my-list-filters .filter-btn.active')?.dataset.status || 'all';
      filterMyList(
        activeFilter,
        state.myListPageMovies,
        state.userMovieList,
        elements.myList.grid,
        elements.myList.sortRatingBtn?.dataset.sortMode || 'added'
      );
    }
  }

  async function localUpdateMovieStatus(movieId, movieData, status) {
    if (!state.currentUser) {
      showNotification('Please log in to update your list.', false);
      switchPage('auth');
      return;
    }

    const currentMovie = state.userMovieList.get(String(movieId)) || {};
    const now = new Date();
    const movieEntry = {
      ...currentMovie,
      ...getStoredMediaFields(movieData, currentMovie),
      addedAt: currentMovie.addedAt || now,
      updatedAt: now,
      status
    };

    try {
      await updateMovieStatus(state.appId, state.currentUser.uid, movieId, movieEntry);
      state.userMovieList.set(String(movieId), movieEntry);
      if (currentMovie.status !== status && (status === 'watching' || status === 'watched')) {
        void publishActivity?.({ type: status === 'watched' ? 'completed' : 'started', movieId, media: movieEntry });
      }
      refreshMyListUI();
    } catch (error) {
      console.error('updateMovieStatus failed:', error);
      throw error;
    }
  }

  async function localUpdateUserRating(movieId, movieData, newRating) {
    if (!state.currentUser) {
      showNotification('Please log in to rate titles.', false);
      switchPage('auth');
      return;
    }

    const currentMovie = state.userMovieList.get(String(movieId)) || {};
    const oldRating = currentMovie.rating;
    const normalizedRating = normalizeRatingForStorage(newRating, settings.ratingSystem);

    if (!normalizedRating) {
      showNotification('Please enter a valid rating.', true);
      return;
    }

    const now = new Date();
    const movieEntry = {
      ...currentMovie,
      ...getStoredMediaFields(movieData, currentMovie),
      addedAt: currentMovie.addedAt || now,
      updatedAt: now,
      rating: normalizedRating
    };

    if (!movieEntry.status) movieEntry.status = 'watched';

    try {
      await updateUserRating(state.appId, state.currentUser.uid, movieId, movieEntry, normalizedRating, oldRating);
      state.userMovieList.set(String(movieId), movieEntry);
      if (Number(oldRating) !== Number(normalizedRating)) {
        void publishActivity?.({ type: 'rated', movieId, media: movieEntry, rating: normalizedRating });
      }
      refreshMyListUI();
    } catch (error) {
      console.error('updateUserRating failed:', error);
      throw error;
    }
  }

  async function localUpdateWatchTime(movieId, movieData, minutes) {
    if (!state.currentUser) return;

    const currentMovie = state.userMovieList.get(String(movieId)) || {};
    const now = new Date();
    const movieEntry = {
      ...currentMovie,
      ...getStoredMediaFields(movieData, currentMovie),
      addedAt: currentMovie.addedAt || now,
      updatedAt: now,
      watchTime: minutes
    };

    if (!movieEntry.status) movieEntry.status = 'watching';

    try {
      await updateWatchTime(state.appId, state.currentUser.uid, movieId, movieEntry, minutes);
      state.userMovieList.set(String(movieId), movieEntry);
      if (!currentMovie.status && Number(minutes) > 0) {
        void publishActivity?.({ type: 'started', movieId, media: movieEntry });
      }
    } catch (error) {
      console.error('updateWatchTime failed:', error);
    }
  }

  async function localUpdateEpisodes(movieId, movieData, episodesData, currentSeason) {
    if (!state.currentUser) {
      showNotification('Please log in to update episode progress.', false);
      switchPage('auth');
      return;
    }

    const currentMovie = state.userMovieList.get(String(movieId)) || {};
    const now = new Date();
    const oldEpisodeTotal = getEpisodeTotal(currentMovie.episodesWatched);
    const newEpisodeTotal = getEpisodeTotal(episodesData);
    const movieEntry = {
      ...currentMovie,
      ...getStoredMediaFields({ ...movieData, type: 'series', media_type: 'tv' }, currentMovie),
      addedAt: currentMovie.addedAt || now,
      updatedAt: now,
      episodesWatched: episodesData,
      currentSeason,
      type: 'series',
      media_type: 'tv'
    };

    if (!movieEntry.status) movieEntry.status = 'watching';

    try {
      await updateEpisodesWatched(state.appId, state.currentUser.uid, movieId, movieEntry, episodesData);
      state.userMovieList.set(String(movieId), movieEntry);
      const crossedMilestone = Math.floor(newEpisodeTotal / 5) > Math.floor(oldEpisodeTotal / 5);
      if (newEpisodeTotal > oldEpisodeTotal && currentMovie.status !== 'watching' && oldEpisodeTotal === 0) {
        void publishActivity?.({ type: 'started', movieId, media: movieEntry, season: currentSeason, episode: episodesData?.[`s${currentSeason}`] || newEpisodeTotal });
      } else if (crossedMilestone) {
        void publishActivity?.({ type: 'episode_milestone', movieId, media: movieEntry, season: currentSeason, episode: episodesData?.[`s${currentSeason}`] || newEpisodeTotal });
      }
      refreshMyListUI();
    } catch (error) {
      console.error('updateEpisodes failed:', error);
    }
  }

  async function localRemoveMovie(movieId) {
    if (!state.currentUser) return;

    const oldRating = state.userMovieList.get(String(movieId))?.rating;

    try {
      await removeMovieFromList(state.appId, state.currentUser.uid, movieId);
      await removeAggregateRating(state.appId, movieId, oldRating);
      try {
        state.myListPageMovies = state.myListPageMovies.filter((movie) => String(movie.id) !== String(movieId));
      } catch (error) {}

      if (state.currentPage === 'my-list') {
        const activeFilter = document.querySelector('#my-list-filters .filter-btn.active')?.dataset.status || 'all';
        renderMyListFilters(elements.myList.filters, activeFilter);
        filterMyList(
          activeFilter,
          state.myListPageMovies,
          state.userMovieList,
          elements.myList.grid,
          elements.myList.sortRatingBtn?.dataset.sortMode || 'added'
        );
      }
    } catch (error) {
      console.error('localRemoveMovie failed', error);
      throw error;
    }
  }

  return {
    refreshMyListUI,
    localUpdateMovieStatus,
    localUpdateUserRating,
    localUpdateWatchTime,
    localUpdateEpisodes,
    localRemoveMovie
  };
}
