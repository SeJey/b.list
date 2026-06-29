import { settings } from '../../settings.js';
import { calculateProfileStats, isSeries } from '../../utils/profileStats.js';
import { escapeAttribute, escapeHtml, formatStoredRating, getMovieProgress, getPosterUrl, getSeriesProgress } from '../../utils/helpers.js';

let profileTabChangeHandler = null;

function getProfileItemTime(item) {
  const value = item.updatedAt || item.addedAt || item.createdAt;
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUserScore(rating) {
  return formatStoredRating(rating, settings);
}

function formatHours(minutes) {
  const hours = Math.max(0, Number(minutes) || 0) / 60;
  return hours >= 100 ? String(Math.round(hours)) : hours.toFixed(1).replace(/\.0$/, '');
}

function selectProfileTab(tabName = 'overview', { focus = false } = {}) {
  const tabs = Array.from(document.querySelectorAll('[data-profile-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-profile-panel]'));
  const selectedTab = tabs.find(tab => tab.dataset.profileTab === tabName) || tabs[0];
  if (!selectedTab) return;

  tabs.forEach(tab => {
    const isSelected = tab === selectedTab;
    tab.classList.toggle('is-active', isSelected);
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  });
  panels.forEach(panel => {
    const isSelected = panel.dataset.profilePanel === selectedTab.dataset.profileTab;
    panel.classList.toggle('hidden', !isSelected);
    panel.hidden = !isSelected;
  });

  if (focus) selectedTab.focus();
  profileTabChangeHandler?.(selectedTab.dataset.profileTab);
}

function setupProfileTabs({ onTabChange } = {}) {
  profileTabChangeHandler = typeof onTabChange === 'function' ? onTabChange : profileTabChangeHandler;
  const tabs = Array.from(document.querySelectorAll('[data-profile-tab]'));
  if (!tabs.length) return;

  tabs.forEach((tab, index) => {
    if (tab.dataset.profileTabBound === 'true') return;
    tab.dataset.profileTabBound = 'true';
    tab.addEventListener('click', () => selectProfileTab(tab.dataset.profileTab));
    tab.addEventListener('keydown', event => {
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      selectProfileTab(tabs[nextIndex].dataset.profileTab, { focus: true });
    });
  });
  selectProfileTab('overview');
}

function renderProfileMediaStrip(container, items, emptyMessage) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p class="col-span-full text-center text-gray-400 text-sm py-10">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const title = item.title || item.name || 'Untitled';
    const progress = isSeries(item) ? getSeriesProgress(item) : getMovieProgress(item);
    return `
      <button type="button" class="profile-media-card text-left group min-w-0" data-movie-id="${escapeAttribute(item.dbId)}">
        <img src="${getPosterUrl(item)}" alt="${escapeAttribute(title)} poster" class="w-full aspect-[2/3] object-cover rounded-md border border-gray-800 group-hover:border-amber-400 transition-colors">
        <p class="text-xs text-white mt-2 truncate">${escapeHtml(title)}</p>
        <p class="text-[11px] text-gray-400 truncate">${escapeHtml(progress.label || item.status || 'Saved')}</p>
      </button>
    `;
  }).join('');
}

function renderGenreOverview(stats) {
  const container = document.getElementById('profile-genre-overview');
  if (!container) return;
  const genres = stats.topGenres || [];
  if (!genres.length) {
    container.innerHTML = '<p class="text-sm text-gray-400">Watch titles with genre data to build this chart.</p>';
    return;
  }

  const maxMinutes = Math.max(...genres.map(genre => genre.minutes), 1);
  container.innerHTML = `
    <div class="space-y-4">
      ${genres.map((genre, index) => `
        <div class="profile-genre-row">
          <div><span>${index + 1}</span><strong>${escapeHtml(genre.name)}</strong></div>
          <p>${formatHours(genre.minutes)} hr</p>
          <div class="profile-genre-track"><i style="width:${Math.max(4, (genre.minutes / maxMinutes) * 100)}%"></i></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTopPerson(containerId, label, person) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!person) {
    container.innerHTML = `<h2 class="profile-panel-title">${escapeHtml(label)}</h2><p class="text-sm text-gray-400">Cast metadata will appear as watched titles are enriched.</p>`;
    return;
  }

  const image = person.profilePath
    ? (String(person.profilePath).startsWith('http') ? person.profilePath : `https://image.tmdb.org/t/p/w185${person.profilePath}`)
    : '';
  container.innerHTML = `
    <p class="eyebrow">Viewing insight</p>
    <h2 class="profile-panel-title">${escapeHtml(label)}</h2>
    <div class="profile-person-insight">
      ${image ? `<img src="${escapeAttribute(image)}" alt="">` : `<span class="profile-person-placeholder">${escapeHtml(person.name.charAt(0))}</span>`}
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <p>${person.appearances} watched title${person.appearances === 1 ? '' : 's'} · ${formatHours(person.minutes)} hr</p>
        ${person.averageRating ? `<p>Average score ${formatUserScore(person.averageRating)}</p>` : ''}
      </div>
    </div>
  `;
}

function renderRatingDistribution(stats) {
  const container = document.getElementById('profile-rating-distribution');
  if (!container) return;
  const maxCount = Math.max(...stats.ratingDistribution.map(bucket => bucket.count), 1);
  container.innerHTML = stats.ratingDistribution.map(bucket => {
    const label = settings.ratingSystem === '1-100' ? `${bucket.min}–${bucket.max}` : bucket.label;
    return `<div><span>${escapeHtml(label)}</span><i><b style="height:${Math.max(bucket.count ? 8 : 0, (bucket.count / maxCount) * 100)}%"></b></i><strong>${bucket.count}</strong></div>`;
  }).join('');
}

function renderPersonalActivity(items) {
  const container = document.getElementById('profile-overview-activity');
  if (!container) return;
  const recent = [...items].sort((a, b) => getProfileItemTime(b) - getProfileItemTime(a)).slice(0, 6);
  if (!recent.length) {
    container.innerHTML = '<p class="col-span-full text-sm text-gray-400">No activity yet. Start or rate a title to build your profile.</p>';
    return;
  }

  container.innerHTML = recent.map(item => {
    const title = item.title || item.name || 'Untitled';
    const status = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Saved';
    const time = getProfileItemTime(item);
    const date = time ? new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently';
    return `
      <button type="button" class="profile-activity-item" data-movie-id="${escapeAttribute(item.dbId)}">
        <img src="${getPosterUrl(item)}" alt="${escapeAttribute(title)} poster">
        <div><span>${escapeHtml(date)}</span><p>${escapeHtml(status)} <strong>${escapeHtml(title)}</strong></p>${item.rating ? `<small>Rating ${formatUserScore(item.rating)}</small>` : ''}</div>
      </button>
    `;
  }).join('');
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function updateProfileStats({ userMovieList = new Map(), userFollowing = new Map(), userFollows = new Map() } = {}) {
  const items = Array.from(userMovieList.entries()).map(([id, item]) => ({ ...item, dbId: String(id) }));
  const stats = calculateProfileStats(items);
  const meanScore = stats.meanRating
    ? (settings.ratingSystem === '1-100' ? String(Math.round(stats.meanRating)) : (stats.meanRating / 10).toFixed(1).replace(/\.0$/, ''))
    : 'N/A';

  setText('stat-movies-watched', stats.statusCounts.watched);
  setText('stat-movies-watching', stats.statusCounts.watching);
  setText('stat-movies-planned', stats.statusCounts.planning);
  setText('profile-total-titles', stats.totalTitles);
  setText('profile-days-watched', (stats.totalMinutes / 1440).toFixed(1).replace(/\.0$/, ''));
  setText('profile-mean-score', meanScore);
  setText('profile-total-hours', formatHours(stats.totalMinutes));
  setText('profile-movie-hours', formatHours(stats.movieMinutes));
  setText('profile-series-hours', formatHours(stats.seriesMinutes));
  setText('profile-episodes-watched', stats.episodesWatched);
  setText('profile-overview-total', stats.totalTitles);
  setText('profile-overview-hours', formatHours(stats.totalMinutes));
  setText('profile-overview-genre', stats.topGenres[0]?.name || '—');
  setText('profile-overview-score', meanScore);
  setText('profile-following-count', `${userFollows?.size || 0} users followed`);

  renderGenreOverview(stats);
  renderRatingDistribution(stats);
  renderTopPerson('profile-top-actor', 'Most watched actor', stats.topActor);
  renderTopPerson('profile-top-director', 'Most watched director', stats.topDirector);
  renderPersonalActivity(items);
  return stats;
}

function updateProfileLists({ userMovieList = new Map() } = {}) {
  const movieGrid = document.getElementById('profile-movie-grid');
  const tvGrid = document.getElementById('profile-tv-grid');
  if (!movieGrid && !tvGrid) return;

  const items = Array.from(userMovieList.entries()).map(([id, item]) => ({ ...item, dbId: String(id) }));
  const movies = items.filter(item => !isSeries(item)).sort((a, b) => getProfileItemTime(b) - getProfileItemTime(a));
  const series = items.filter(item => isSeries(item)).sort((a, b) => getProfileItemTime(b) - getProfileItemTime(a));
  renderProfileMediaStrip(movieGrid, movies, 'No movies saved yet.');
  renderProfileMediaStrip(tvGrid, series, 'No series saved yet.');
}

function setProfileStatsEnrichment(message = '') {
  const element = document.getElementById('profile-stats-enrichment');
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('hidden', !message);
}

export { selectProfileTab, setupProfileTabs, updateProfileStats, updateProfileLists, setProfileStatsEnrichment };
