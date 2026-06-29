function isSeries(item = {}) {
  const id = String(item.dbId || item.id || '');
  return item.type === 'series' || item.media_type === 'tv' || id.startsWith('tmdb_tv_') || id.startsWith('tvdb_');
}

function getEpisodesWatched(item = {}) {
  if (item.episodesWatched && typeof item.episodesWatched === 'object') {
    return Object.values(item.episodesWatched).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  }
  return Math.max(0, Number(item.episodesWatched) || 0);
}

function getItemWatchMinutes(item = {}) {
  if (isSeries(item)) {
    const watchedEpisodes = getEpisodesWatched(item);
    const totalEpisodes = Math.max(0, Number(item.numberOfEpisodes || item.number_of_episodes || item.totalEpisodes) || 0);
    const episodeRuntime = Math.max(0, Number(item.averageRuntime || item.episodeRuntime || item.episode_run_time?.[0] || item.runtime) || 0);
    const episodeCount = item.status === 'watched' && totalEpisodes > 0
      ? Math.max(watchedEpisodes, totalEpisodes)
      : watchedEpisodes;
    return episodeCount * episodeRuntime;
  }

  const runtime = Math.max(0, Number(item.runtime) || 0);
  const progress = Math.max(0, Number(item.watchTime) || 0);
  if (item.status === 'watched') return runtime || progress;
  return runtime > 0 ? Math.min(progress, runtime) : progress;
}

function normalizePeople(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(person => typeof person === 'string' ? { name: person } : person)
    .filter(person => person?.name)
    .map(person => ({
      id: String(person.id || person.name),
      name: String(person.name),
      profilePath: person.profilePath || person.profile_path || ''
    }));
}

function getRating(item = {}) {
  const rating = Number(item.rating);
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  return rating <= 10 ? rating * 10 : Math.min(100, rating);
}

function rankPeople(items, field) {
  const people = new Map();
  items.forEach(({ item, minutes }) => {
    const rating = getRating(item);
    const source = item.analytics?.[field] || item[field] || [];
    normalizePeople(source).forEach(person => {
      const current = people.get(person.id) || { ...person, appearances: 0, minutes: 0, ratingTotal: 0, ratedTitles: 0 };
      current.appearances += 1;
      current.minutes += minutes;
      if (rating) {
        current.ratingTotal += rating;
        current.ratedTitles += 1;
      }
      people.set(person.id, current);
    });
  });

  return Array.from(people.values())
    .map(person => ({
      ...person,
      averageRating: person.ratedTitles ? person.ratingTotal / person.ratedTitles : 0
    }))
    .sort((a, b) => b.appearances - a.appearances || b.averageRating - a.averageRating || b.minutes - a.minutes || a.name.localeCompare(b.name));
}

function calculateProfileStats(items = []) {
  const normalized = (Array.isArray(items) ? items : []).filter(Boolean);
  const statusCounts = { watched: 0, watching: 0, planning: 0, other: 0 };
  normalized.forEach(item => {
    const status = Object.prototype.hasOwnProperty.call(statusCounts, item.status) ? item.status : 'other';
    statusCounts[status] += 1;
  });

  const qualifying = normalized
    .map(item => {
      const recordedEpisodes = getEpisodesWatched(item);
      const totalEpisodes = Math.max(0, Number(item.numberOfEpisodes || item.number_of_episodes || item.totalEpisodes) || 0);
      const episodes = isSeries(item) && item.status === 'watched' && totalEpisodes > 0
        ? Math.max(recordedEpisodes, totalEpisodes)
        : recordedEpisodes;
      return { item, minutes: getItemWatchMinutes(item), episodes };
    })
    .filter(entry => entry.item.status === 'watched' || entry.minutes > 0 || entry.episodes > 0);

  let movieMinutes = 0;
  let seriesMinutes = 0;
  let episodesWatched = 0;
  const genres = new Map();
  qualifying.forEach(entry => {
    if (isSeries(entry.item)) {
      seriesMinutes += entry.minutes;
      episodesWatched += entry.episodes;
    } else {
      movieMinutes += entry.minutes;
    }

    const itemGenres = (entry.item.analytics?.genres || entry.item.genres || [])
      .map(genre => typeof genre === 'string' ? genre : genre?.name)
      .filter(Boolean);
    const allocatedMinutes = itemGenres.length ? entry.minutes / itemGenres.length : 0;
    itemGenres.forEach(name => genres.set(name, (genres.get(name) || 0) + allocatedMinutes));
  });

  const ratings = normalized.map(getRating).filter(Boolean);
  const ratingDistribution = [
    { label: '1–2', min: 1, max: 20, count: 0 },
    { label: '3–4', min: 21, max: 40, count: 0 },
    { label: '5–6', min: 41, max: 60, count: 0 },
    { label: '7–8', min: 61, max: 80, count: 0 },
    { label: '9–10', min: 81, max: 100, count: 0 }
  ];
  ratings.forEach(rating => {
    const bucket = ratingDistribution.find(entry => rating >= entry.min && rating <= entry.max);
    if (bucket) bucket.count += 1;
  });
  const meanRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
  const topGenres = Array.from(genres.entries())
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
    .slice(0, 5);

  return {
    totalTitles: normalized.length,
    qualifyingTitles: qualifying.length,
    completedTitles: statusCounts.watched,
    statusCounts,
    movieMinutes,
    seriesMinutes,
    totalMinutes: movieMinutes + seriesMinutes,
    episodesWatched,
    meanRating,
    ratingCount: ratings.length,
    ratingDistribution,
    topGenres,
    topActor: rankPeople(qualifying, 'cast')[0] || null,
    topDirector: rankPeople(qualifying, 'directors')[0] || null
  };
}

export { calculateProfileStats, getEpisodesWatched, getItemWatchMinutes, isSeries };
