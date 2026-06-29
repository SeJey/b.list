function compactPeople(people = [], max = 12) {
  return (Array.isArray(people) ? people : [])
    .filter(person => person?.name)
    .filter((person, index, list) => list.findIndex(candidate => String(candidate.id || candidate.name) === String(person.id || person.name)) === index)
    .slice(0, max)
    .map(person => ({ id: person.id || person.name, name: person.name, profilePath: person.profile_path || person.profilePath || '' }));
}

function needsAnalytics(item = {}) {
  if (Number(item.analyticsVersion) >= 1 && Array.isArray(item.cast) && Array.isArray(item.genres)) return false;
  const hasProgress = item.status === 'watched' || (Number(item.watchTime) || 0) > 0 || Object.values(item.episodesWatched || {}).some(value => Number(value) > 0);
  return hasProgress;
}

export function createProfileMetadataBackfill({
  state,
  fetchTMDb,
  normalizeMediaItem,
  patchUserMovieAnalytics,
  updateProfileStats,
  updateProfileLists,
  setProfileStatsEnrichment
}) {
  async function enrichOne([mediaId, current]) {
    const id = String(mediaId);
    if (id.startsWith('tvdb_')) return false;
    const isTv = id.startsWith('tmdb_tv_') || current.type === 'series' || current.media_type === 'tv';
    const tmdbId = id.replace(isTv ? 'tmdb_tv_' : 'tmdb_', '');
    if (!/^\d+$/.test(tmdbId)) return false;

    const [details, credits] = await Promise.all([
      fetchTMDb(isTv ? `/tv/${tmdbId}` : `/movie/${tmdbId}`, 'language=en-US'),
      fetchTMDb(isTv ? `/tv/${tmdbId}/aggregate_credits` : `/movie/${tmdbId}/credits`, 'language=en-US').catch(() => ({ cast: [], crew: [] }))
    ]);
    const media = normalizeMediaItem(details, isTv ? 'series' : 'movie');
    const castSource = isTv
      ? (credits.cast || []).map(person => ({ ...person, profilePath: person.profile_path }))
      : credits.cast || [];
    const crewSource = isTv
      ? (credits.crew || []).flatMap(person => (person.jobs || [{ job: person.job }]).map(job => ({ ...person, job: job.job })))
      : credits.crew || [];
    const analytics = {
      genres: (media.genres || []).map(genre => ({ id: genre.id || null, name: genre.name || String(genre) })).filter(genre => genre.name),
      cast: compactPeople(castSource),
      directors: compactPeople(crewSource.filter(person => person.job === 'Director' || person.job === 'Creator' || person.department === 'Directing'), 5),
      runtime: Number(media.runtime) || null,
      averageRuntime: Number(media.averageRuntime || media.episode_run_time?.[0]) || null,
      numberOfEpisodes: Number(media.numberOfEpisodes || media.number_of_episodes) || null,
      mediaType: isTv ? 'series' : 'movie'
    };

    await patchUserMovieAnalytics(state.appId, state.currentUser.uid, id, analytics);
    state.userMovieList.set(id, { ...current, ...analytics, analytics, analyticsVersion: 1 });
    return true;
  }

  async function backfill() {
    if (state.profileMetadataBackfillInProgress || !state.currentUser) return;
    const candidates = Array.from(state.userMovieList.entries()).filter(([, item]) => needsAnalytics(item));
    if (!candidates.length) {
      setProfileStatsEnrichment('');
      return;
    }

    state.profileMetadataBackfillInProgress = true;
    let cursor = 0;
    let completed = 0;
    setProfileStatsEnrichment(`Enriching ${candidates.length} older title${candidates.length === 1 ? '' : 's'} for deeper insights…`);
    const worker = async () => {
      while (cursor < candidates.length) {
        const candidate = candidates[cursor++];
        try {
          if (await enrichOne(candidate)) completed += 1;
        } catch (error) {
          console.warn('Profile analytics enrichment failed for', candidate[0], error);
        }
      }
    };

    try {
      await Promise.all([worker(), worker(), worker()]);
      updateProfileStats({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });
      updateProfileLists({ userMovieList: state.userMovieList });
      setProfileStatsEnrichment(completed < candidates.length ? 'Some older titles could not be enriched yet; available statistics are shown.' : '');
    } finally {
      state.profileMetadataBackfillInProgress = false;
    }
  }

  return { backfill };
}
