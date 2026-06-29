/**
 * Wires media card custom events used across grids and progress sections.
 */
export function setupMediaCardEventHandlers({
  fetchTMDb,
  // TVDB hooks are kept for reference/legacy fallback, but active TV loading uses TMDb.
  getSeriesDetails,
  getSeriesTranslation,
  tvdbHasEnglishOverview,
  normalizeMediaItem,
  enrichSeriesWithEnglishTitle,
  buildTvdbCredits,
  openMovieModal,
  showMoviePage,
  callGeminiApi,
  settings,
  getUserMovieList,
  getRatingSummary,
  subscribeRatingSummary,
  subscribeToMovieReviews,
  upsertMovieReview,
  setCurrentModalData,
  updateFollowButtonsState,
  updateFollowUserButtonsState,
  showNotification,
  switchPage,
  getCurrentUser,
  localUpdateMovieStatus,
  localUpdateUserRating,
  localUpdateWatchTime,
  localUpdateEpisodes,
  localRemoveMovie
}) {
  function buildTmdbTvCredits(aggregateCredits = {}) {
    const cast = Array.isArray(aggregateCredits.cast)
      ? aggregateCredits.cast.map(person => ({
          ...person,
          character: person.roles?.map(role => role.character).filter(Boolean).join(', ') || person.character || ''
        }))
      : [];

    const crew = Array.isArray(aggregateCredits.crew)
      ? aggregateCredits.crew.flatMap(person => {
          const jobs = Array.isArray(person.jobs) && person.jobs.length ? person.jobs : [{ job: person.job }];
          return jobs.map(jobInfo => ({
            ...person,
            job: jobInfo.job || person.job || 'Crew'
          }));
        })
      : [];

    return { cast, crew };
  }

  async function loadMediaDetails(mediaId) {
    try {
      let media;
      let credits;

      if (String(mediaId).startsWith('tmdb_tv_')) {
        const seriesId = String(mediaId).replace('tmdb_tv_', '');
        const [seriesDetails, aggregateCredits, keywords] = await Promise.all([
          fetchTMDb(`/tv/${seriesId}`, 'language=en-US'),
          fetchTMDb(`/tv/${seriesId}/aggregate_credits`, 'language=en-US').catch(() => ({ cast: [], crew: [] })),
          fetchTMDb(`/tv/${seriesId}/keywords`).catch(() => ({ results: [] }))
        ]);
        media = normalizeMediaItem(seriesDetails, 'series');
        media.keywords = keywords?.results || [];
        credits = buildTmdbTvCredits(aggregateCredits);
      } else if (String(mediaId).startsWith('tvdb_')) {
        // Previous TVDB detail path kept for reference:
        // media = await getSeriesDetails(seriesId);
        // media = normalizeMediaItem(media, 'series');
        // credits = buildTvdbCredits(media);
        const savedSeries = getUserMovieList().get(String(mediaId));
        if (!savedSeries) {
          showNotification('This older TVDB series needs to be re-added from TMDb search.', true);
          return null;
        }
        media = normalizeMediaItem(savedSeries, 'series');
        credits = buildTvdbCredits(media);
      } else {
        const movieId = String(mediaId).replace('tmdb_', '');
        const [movieDetails, movieCredits, keywords] = await Promise.all([
          fetchTMDb(`/movie/${movieId}`),
          fetchTMDb(`/movie/${movieId}/credits`),
          fetchTMDb(`/movie/${movieId}/keywords`).catch(() => ({ keywords: [] }))
        ]);
        media = normalizeMediaItem(movieDetails, 'movie');
        media.keywords = keywords?.keywords || [];
        credits = movieCredits;
      }

      media.cast = (credits?.cast || []).slice(0, 12).map(person => ({
        id: person.id || person.name,
        name: person.name,
        profilePath: person.profile_path || person.profilePath || ''
      }));
      media.directors = (credits?.crew || [])
        .filter(person => person.job === 'Director' || person.job === 'Creator' || person.department === 'Directing')
        .filter((person, index, list) => list.findIndex(candidate => String(candidate.id || candidate.name) === String(person.id || person.name)) === index)
        .slice(0, 5)
        .map(person => ({ id: person.id || person.name, name: person.name, profilePath: person.profile_path || person.profilePath || '' }));

      return { media, credits };
    } catch (error) {
      console.error('Error loading media details:', error);
      showNotification('Failed to load media details.', true);
      return null;
    }
  }

  document.addEventListener('movieCardClick', async (e) => {
    const mediaId = e.detail.movieId;
    const details = await loadMediaDetails(mediaId);
    if (!details) return;

    try {
      const { media, credits } = details;
      setCurrentModalData(media, credits);
      const movieInfo = getUserMovieList().get(media.dbId || String(mediaId)) || getUserMovieList().get(String(mediaId)) || {};
      openMovieModal(media, credits, {
        movieInfo,
        backPage: e.detail?.backPage || 'home',
        settings,
        localUpdateMovieStatus,
        localUpdateUserRating,
        localUpdateWatchTime,
        localUpdateEpisodes,
        localRemoveMovie,
        callGeminiApi
      });
      updateFollowButtonsState(document.getElementById('modal-content') || document);
    } catch (error) {
      console.error('Error opening movie modal:', error);
      showNotification('Failed to load media details.', true);
    }
  });

  document.addEventListener('openMoviePage', async (e) => {
    const mediaId = e.detail?.movieId;
    if (!mediaId) return;
    const backScrollY = window.scrollY;
    const details = await loadMediaDetails(mediaId);
    if (!details) return;

    try {
      const { media, credits } = details;
      setCurrentModalData(media, credits);
      const movieInfo = getUserMovieList().get(media.dbId || String(mediaId)) || getUserMovieList().get(String(mediaId)) || {};
      const ratingSummary = typeof getRatingSummary === 'function'
        ? await getRatingSummary(media.dbId || String(mediaId))
        : null;
      switchPage('movie');
      showMoviePage(media, credits, {
        movieInfo,
        currentUser: getCurrentUser(),
        ratingSummary,
        subscribeRatingSummary,
        subscribeToMovieReviews,
        upsertMovieReview,
        updateFollowUserButtonsState,
        showNotification,
        settings,
        backPage: e.detail?.backPage || 'home',
        backScrollY,
        localUpdateMovieStatus,
        localUpdateUserRating,
        localUpdateWatchTime,
        localUpdateEpisodes,
        localRemoveMovie,
        callGeminiApi
      });
      window.scrollTo({ top: 0, behavior: 'auto' });
      updateFollowButtonsState(document.getElementById('movie-page') || document);
    } catch (error) {
      console.error('Error opening movie page:', error);
      showNotification('Failed to load media details.', true);
    }
  });

  document.addEventListener('addToListClick', async (e) => {
    const mediaId = String(e.detail.movieId || '');
    if (!mediaId) return;

    try {
      if (!getCurrentUser()) {
        showNotification('Please log in to add titles to your list.', false);
        switchPage('auth');
        return;
      }

      if (mediaId.startsWith('tvdb_')) {
        // Previous TVDB path:
        // const series = await getSeriesDetails(mediaId.replace('tvdb_', ''));
        // await localUpdateMovieStatus(mediaId, normalizeMediaItem(series, 'series'), 'planning');
        throw new Error('Legacy TVDB add path is disabled while TMDb TV is active.');
      } else {
        const details = await loadMediaDetails(mediaId);
        if (!details?.media) throw new Error('Media details unavailable');
        await localUpdateMovieStatus(mediaId, details.media, settings.preferences?.defaultAddStatus || 'planning');
      }

      showNotification('Added to your list!', false);
    } catch (err) {
      console.error('Card add failed:', err);
      showNotification('Could not add to your list.', true);
    }
  });
}
