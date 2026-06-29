/**
 * Browse Filters Component
 * Handles filter dropdowns and logic for movies and series
 */

import { fetchTMDb } from '../../api/tmdb.js';
// TVDB filter sources are parked for now; series browsing now uses TMDb TV endpoints.
// import { getTVDBGenres, getSeriesStatuses } from '../../api/tvdb.js';
import { escapeHtml } from '../../utils/helpers.js';

// Cache for API data
export let genresList = [];
export let movieKeywordsList = [];
export let tvdbGenresList = [];
export let tvdbSeriesStatuses = [];
export let selectedSeriesCountry = 'usa';
export let selectedSeriesLanguage = 'eng';

export const movieTagChips = [
  { id: 'superhero', name: 'Superhero', filters: [{ type: 'keyword', id: 9715, name: 'Superhero' }] },
  { id: 'time-travel', name: 'Time Travel', filters: [{ type: 'keyword', id: 1701, name: 'Time Travel' }] },
  { id: 'book-adaptations', name: 'Based on a Book', filters: [{ type: 'keyword', id: 9672, name: 'Based on a Book' }] },
  { id: 'dystopian', name: 'Dystopian', filters: [{ type: 'keyword', id: 4565, name: 'Dystopia' }] },
  { id: 'heist', name: 'Heist', filters: [{ type: 'keyword', id: 10249, name: 'Heist' }] },
  { id: 'revenge', name: 'Revenge', filters: [{ type: 'keyword', id: 9748, name: 'Revenge' }] },
  { id: 'zombies', name: 'Zombies', filters: [{ type: 'keyword', id: 1299, name: 'Zombie' }] },
  { id: 'vampires', name: 'Vampires', filters: [{ type: 'keyword', id: 6149, name: 'Vampire' }] },
  { id: 'space', name: 'Space', filters: [{ type: 'keyword', id: 9882, name: 'Space' }] },
  { id: 'musicals', name: 'Musicals', filters: [{ type: 'keyword', id: 4344, name: 'Musical' }] },
  { id: 'family-night', name: 'Family Night', filters: [{ type: 'genre', id: 10751, name: 'Family' }] },
  { id: 'comic-book', name: 'Comic Book', filters: [{ type: 'keyword', id: 818, name: 'Based on Comic' }] },
  { id: 'anti-hero', name: 'Anti-Hero', searchName: 'anti hero' },
  { id: 'ensemble-cast', name: 'Ensemble Cast', searchName: 'ensemble cast' },
  { id: 'female-protagonist', name: 'Female Protagonist', searchName: 'female protagonist' },
  { id: 'coming-of-age', name: 'Coming of Age', searchName: 'coming of age' },
  { id: 'high-school', name: 'High School', searchName: 'high school' },
  { id: 'road-trip', name: 'Road Trip', searchName: 'road trip' },
  { id: 'survival', name: 'Survival', searchName: 'survival' },
  { id: 'disaster', name: 'Disaster', searchName: 'disaster' },
  { id: 'martial-arts', name: 'Martial Arts', searchName: 'martial arts' },
  { id: 'spy', name: 'Spy', searchName: 'spy' },
  { id: 'gangster', name: 'Gangster', searchName: 'gangster' },
  { id: 'mafia', name: 'Mafia', searchName: 'mafia' },
  { id: 'detective', name: 'Detective', searchName: 'detective' },
  { id: 'serial-killer', name: 'Serial Killer', searchName: 'serial killer' },
  { id: 'whodunit', name: 'Whodunit', searchName: 'whodunit' },
  { id: 'psychological', name: 'Psychological', searchName: 'psychological' },
  { id: 'plot-twist', name: 'Plot Twist', searchName: 'plot twist' },
  { id: 'found-footage', name: 'Found Footage', searchName: 'found footage' },
  { id: 'haunted-house', name: 'Haunted House', searchName: 'haunted house' },
  { id: 'slasher', name: 'Slasher', searchName: 'slasher' },
  { id: 'ghost', name: 'Ghost', searchName: 'ghost' },
  { id: 'witch', name: 'Witch', searchName: 'witch' },
  { id: 'monster', name: 'Monster', searchName: 'monster' },
  { id: 'alien-invasion', name: 'Alien Invasion', searchName: 'alien invasion' },
  { id: 'post-apocalyptic', name: 'Post-Apocalyptic', searchName: 'post-apocalyptic' },
  { id: 'cyberpunk', name: 'Cyberpunk', searchName: 'cyberpunk' },
  { id: 'artificial-intelligence', name: 'Artificial Intelligence', searchName: 'artificial intelligence' },
  { id: 'robot', name: 'Robot', searchName: 'robot' },
  { id: 'parallel-universe', name: 'Parallel Universe', searchName: 'parallel universe' },
  { id: 'space-opera', name: 'Space Opera', searchName: 'space opera' },
  { id: 'courtroom', name: 'Courtroom', searchName: 'courtroom' },
  { id: 'prison', name: 'Prison', searchName: 'prison' },
  { id: 'political', name: 'Political', searchName: 'political' },
  { id: 'sports', name: 'Sports', searchName: 'sports' },
  { id: 'boxing', name: 'Boxing', searchName: 'boxing' },
  { id: 'dance', name: 'Dance', searchName: 'dance' },
  { id: 'workplace', name: 'Workplace', searchName: 'workplace' },
  { id: 'wedding', name: 'Wedding', searchName: 'wedding' },
  { id: 'christmas', name: 'Christmas', searchName: 'christmas' },
  { id: 'holiday', name: 'Holiday', searchName: 'holiday' },
  { id: 'lgbtq', name: 'LGBTQ+', searchName: 'lgbt' }
];

export const seriesTagChips = [
  { id: 'bingeable', name: 'Bingeable', filters: [{ type: 'statusName', name: 'Ended', fallbackId: '3' }] },
  { id: 'still-airing', name: 'Still Airing', filters: [{ type: 'statusName', name: 'Returning Series', fallbackId: '0' }] },
  { id: 'animated', name: 'Animated', filters: [{ type: 'genreAny', names: ['Animation', 'Anime'] }] },
  { id: 'anime', name: 'Anime', filters: [{ type: 'genreAny', names: ['Anime', 'Animation'] }, { type: 'country', id: 'jpn', name: 'Japan' }] },
  { id: 'docuseries', name: 'Docuseries', filters: [{ type: 'genreAny', names: ['Documentary'] }] },
  { id: 'crime', name: 'Crime', filters: [{ type: 'genreAny', names: ['Crime'] }] },
  { id: 'reality', name: 'Reality', filters: [{ type: 'genreAny', names: ['Reality'] }] },
  { id: 'sci-fi-fantasy', name: 'Sci-Fi & Fantasy', filters: [{ type: 'genreAny', names: ['Sci-Fi & Fantasy', 'Science Fiction', 'Sci-Fi', 'Fantasy'] }] },
  { id: 'comedy', name: 'Comedy', filters: [{ type: 'genreAny', names: ['Comedy'] }] },
  { id: 'mystery', name: 'Mystery', filters: [{ type: 'genreAny', names: ['Mystery'] }] }
];

function getFilterKey(filter) {
  return `${filter.type}:${filter.id ?? filter.name ?? filter.query ?? ''}`;
}

function dedupeFilters(filters) {
  const byKey = new Map();
  filters.forEach(filter => {
    if (!filter) return;
    byKey.set(getFilterKey(filter), filter);
  });
  return Array.from(byKey.values());
}

export function getExpandedMovieFilters(activeMovieFilters = []) {
  return dedupeFilters(activeMovieFilters.flatMap(filter => (
    filter.type === 'movieTag' && Array.isArray(filter.filters)
      ? filter.filters
      : [filter]
  )));
}

export function getExpandedSeriesFilters(activeSeriesFilters = []) {
  return dedupeFilters(activeSeriesFilters.flatMap(filter => (
    filter.type === 'seriesTag' && Array.isArray(filter.filters)
      ? filter.filters
      : [filter]
  )));
}

function renderTagChips(container, tags, activeFilters, activeType, eventName) {
  if (!container) return;
  container.innerHTML = tags.map(tag => {
    const isActive = activeFilters.some(filter => filter.type === activeType && String(filter.id) === String(tag.id));
    const className = isActive
      ? 'px-3 py-1.5 rounded-md bg-sky-600 border border-sky-400 text-sm text-white font-medium transition-colors'
      : 'px-3 py-1.5 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 hover:border-sky-400 hover:text-white transition-colors';
    return `<button type="button" class="${className}" data-tag-id="${escapeHtml(tag.id)}">${escapeHtml(tag.name)}</button>`;
  }).join('');

  container.querySelectorAll('[data-tag-id]').forEach(button => {
    button.addEventListener('click', () => {
      const tag = tags.find(item => String(item.id) === String(button.dataset.tagId));
      if (!tag) return;
      document.dispatchEvent(new CustomEvent(eventName, { detail: { tag } }));
    });
  });
}

export function renderSeriesTagChips(activeSeriesFilters, container) {
  renderTagChips(container, seriesTagChips, activeSeriesFilters, 'seriesTag', 'applySeriesTag');
}

function renderMovieTagDropdownOptions(container, activeMovieFilters, tags, searchResults = []) {
  if (!container) return;
  const activeTagIds = new Set(
    activeMovieFilters
      .filter(filter => filter.type === 'movieTag')
      .map(filter => String(filter.id))
  );
  const activeKeywordIds = new Set(
    getExpandedMovieFilters(activeMovieFilters)
      .filter(filter => filter.type === 'keyword')
      .map(filter => String(filter.id))
  );

  const suggestedHtml = tags.map(tag => {
    const isActive = activeTagIds.has(String(tag.id));
    return `
      <div class="dropdown-option px-4 py-2 hover:bg-gray-700 cursor-pointer text-white ${isActive ? 'bg-blue-900' : ''}" data-tag-id="${escapeHtml(tag.id)}">
        ${isActive ? '✓ ' : ''}${escapeHtml(tag.name)}
      </div>
    `;
  }).join('');

  const searchHtml = searchResults.length
    ? `
      <div class="px-4 pt-3 pb-1 text-xs uppercase tracking-wide text-gray-400">Search Results</div>
      ${searchResults.map(result => {
        const isActive = activeKeywordIds.has(String(result.id));
        return `
          <div class="dropdown-option px-4 py-2 hover:bg-gray-700 cursor-pointer text-white ${isActive ? 'bg-blue-900' : ''}" data-keyword-id="${escapeHtml(result.id)}" data-keyword-name="${escapeHtml(result.name)}">
            ${isActive ? '✓ ' : ''}${escapeHtml(result.name)}
          </div>
        `;
      }).join('')}
    `
    : '';

  container.innerHTML = `
    <div class="sticky top-0 bg-gray-800 p-3 border-b border-gray-700 z-10">
      <input id="movie-tag-search-input" type="search" class="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Type any tag..." autocomplete="off">
      <p class="mt-2 text-xs text-gray-400">Pick suggested tags or search TMDb keywords.</p>
    </div>
    <div id="movie-tag-search-results">${searchHtml}</div>
    <div class="px-4 pt-3 pb-1 text-xs uppercase tracking-wide text-gray-400">Suggested</div>
    <div id="movie-tag-suggestions">${suggestedHtml}</div>
  `;
}

function bindMovieTagDropdownHandlers(movieKeywordsDropdown, activeMovieFilters) {
  const dispatchTag = (tag) => {
    document.dispatchEvent(new CustomEvent('applyMovieTag', {
      detail: { tag }
    }));
  };

  movieKeywordsDropdown.querySelectorAll('[data-tag-id]').forEach(option => {
    option.addEventListener('click', () => {
      const tag = movieTagChips.find(item => String(item.id) === String(option.dataset.tagId));
      if (!tag) return;
      dispatchTag(tag);
    });
  });

  movieKeywordsDropdown.querySelectorAll('[data-keyword-id]').forEach(option => {
    option.addEventListener('click', () => {
      dispatchTag({
        id: `keyword-${option.dataset.keywordId}`,
        name: option.dataset.keywordName,
        filters: [{ type: 'keyword', id: option.dataset.keywordId, name: option.dataset.keywordName }]
      });
    });
  });

  const input = movieKeywordsDropdown.querySelector('#movie-tag-search-input');
  if (!input) return;

  let searchTimer = null;
  input.addEventListener('click', (event) => event.stopPropagation());
  input.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    const query = input.value.trim();
    searchTimer = window.setTimeout(async () => {
      if (!query) {
        renderMovieTagDropdownOptions(movieKeywordsDropdown, activeMovieFilters, movieTagChips);
        bindMovieTagDropdownHandlers(movieKeywordsDropdown, activeMovieFilters);
        movieKeywordsDropdown.querySelector('#movie-tag-search-input')?.focus();
        return;
      }

      try {
        const data = await fetchTMDb('/search/keyword', `query=${encodeURIComponent(query)}`);
        const results = (data.results || []).slice(0, 12);
        renderMovieTagDropdownOptions(movieKeywordsDropdown, activeMovieFilters, movieTagChips, results);
        const nextInput = movieKeywordsDropdown.querySelector('#movie-tag-search-input');
        if (nextInput) {
          nextInput.value = query;
          nextInput.focus();
        }
        bindMovieTagDropdownHandlers(movieKeywordsDropdown, activeMovieFilters);
      } catch (error) {
        console.error('Movie tag search failed:', error);
      }
    }, 250);
  });
}

export async function populateMovieDropdowns(activeMovieFilters, movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown) {
  try {
    const expandedMovieFilters = getExpandedMovieFilters(activeMovieFilters);

    // Fetch genres if not cached
    if (genresList.length === 0) {
      const genresData = await fetchTMDb('/genre/movie/list');
      genresList = genresData.genres || [];
    }
    
    // Populate genre dropdown
    if (movieGenreDropdown) {
      movieGenreDropdown.innerHTML = genresList.map(genre => {
        const isActive = expandedMovieFilters.some(f => f.type === 'genre' && f.id == genre.id);
        return `
        <div class="dropdown-option px-4 py-2 hover:bg-gray-700 cursor-pointer text-white ${isActive ? 'bg-blue-900' : ''}" data-type="genre" data-id="${genre.id}" data-name="${genre.name}">
          ${isActive ? '✓ ' : ''}${genre.name}
        </div>
      `;
      }).join('');
    }
    
    // Populate tags and themes dropdown
    if (movieKeywordsDropdown) {
      renderMovieTagDropdownOptions(movieKeywordsDropdown, activeMovieFilters, movieTagChips);
    }
    
    // Populate rating dropdown
    const certifications = [
      { value: 'G', label: 'G' },
      { value: 'PG', label: 'PG' },
      { value: 'PG-13', label: 'PG-13' },
      { value: 'R', label: 'R' },
      { value: 'NC-17', label: 'NC-17' },
      { value: 'NR', label: 'Not Rated' }
    ];
    
    if (movieRatingDropdown) {
      movieRatingDropdown.innerHTML = certifications.map(cert => {
        const isActive = expandedMovieFilters.some(f => f.type === 'certification' && f.id === cert.value);
        return `
        <div class="dropdown-option px-4 py-2 hover:bg-gray-700 cursor-pointer text-white ${isActive ? 'bg-blue-900' : ''}" data-type="certification" data-id="${cert.value}" data-name="${cert.label}">
          ${isActive ? '✓ ' : ''}${cert.label}
        </div>
      `;
      }).join('');
    }
    
    // Add click handlers
    document.querySelectorAll('#movie-genre-dropdown .dropdown-option, #movie-rating-dropdown .dropdown-option').forEach(option => {
      option.addEventListener('click', () => {
        const type = option.dataset.type;
        const id = option.dataset.id;
        const name = option.dataset.name;
        document.dispatchEvent(new CustomEvent('applyMovieFilter', {
          detail: { type, id, name }
        }));
      });
    });

    if (movieKeywordsDropdown) bindMovieTagDropdownHandlers(movieKeywordsDropdown, activeMovieFilters);
  } catch (error) {
    console.error('Error populating movie dropdowns:', error);
  }
}

export async function populateSeriesDropdowns(activeSeriesFilters, seriesGenreDropdown, seriesNetworksDropdown, seriesStatusDropdown, seriesCountryDropdown, seriesLanguageDropdown) {
  try {
    const expandedSeriesFilters = getExpandedSeriesFilters(activeSeriesFilters);

    if (tvdbGenresList.length === 0) {
      const genreData = await fetchTMDb('/genre/tv/list', 'language=en-US');
      tvdbGenresList = genreData?.genres || [];
    }

    const fallbackGenres = [
      { id: 'Action', name: 'Action' },
      { id: 'Adventure', name: 'Adventure' },
      { id: 'Animation', name: 'Animation' },
      { id: 'Comedy', name: 'Comedy' },
      { id: 'Crime', name: 'Crime' },
      { id: 'Documentary', name: 'Documentary' },
      { id: 'Drama', name: 'Drama' },
      { id: 'Family', name: 'Family' },
      { id: 'Fantasy', name: 'Fantasy' },
      { id: 'Horror', name: 'Horror' },
      { id: 'Mystery', name: 'Mystery' },
      { id: 'Romance', name: 'Romance' },
      { id: 'Sci-Fi', name: 'Sci-Fi' },
      { id: 'Thriller', name: 'Thriller' },
      { id: 'War', name: 'War' },
      { id: 'Western', name: 'Western' }
    ];

    const genres = tvdbGenresList.length ? tvdbGenresList : fallbackGenres;

    if (seriesGenreDropdown) {
      seriesGenreDropdown.innerHTML = genres.map(genre => {
        const isActive = expandedSeriesFilters.some(f => f.type === 'genre' && String(f.id) === String(genre.id));
        return `
        <div class="dropdown-option px-4 py-2 ${isActive ? 'bg-blue-900 text-white' : 'hover:bg-gray-700'} cursor-pointer text-white" data-type="genre" data-id="${genre.id}" data-name="${genre.name}">
          ${genre.name}${isActive ? ' ✓' : ''}
        </div>
      `;
      }).join('');
    }
    
    // TMDb discover/tv supports with_status values; keep this local to avoid TVDB auth.
    if (tvdbSeriesStatuses.length === 0) {
      tvdbSeriesStatuses = [
        { id: '0', name: 'Returning Series' },
        { id: '1', name: 'Planned' },
        { id: '2', name: 'In Production' },
        { id: '3', name: 'Ended' },
        { id: '4', name: 'Canceled' },
        { id: '5', name: 'Pilot' }
      ];
    }

    if (seriesStatusDropdown) {
      seriesStatusDropdown.innerHTML = tvdbSeriesStatuses.map(status => {
        const isActive = expandedSeriesFilters.some(f => f.type === 'status' && String(f.id) === String(status.id));
        return `
        <div class="dropdown-option px-4 py-2 ${isActive ? 'bg-blue-900 text-white' : 'hover:bg-gray-700'} cursor-pointer text-white" data-type="status" data-id="${status.id}" data-name="${status.name}">
          ${status.name}${isActive ? ' ✓' : ''}
        </div>
      `;
      }).join('');
    }
    
    // Add click handlers for all series filter dropdowns
    document.querySelectorAll('#series-genre-dropdown .dropdown-option, #series-status-dropdown .dropdown-option').forEach(option => {
      option.addEventListener('click', () => {
        const type = option.dataset.type;
        const id = option.dataset.id;
        const name = option.dataset.name;
        document.dispatchEvent(new CustomEvent('applySeriesFilter', {
          detail: { type, id, name }
        }));
      });
    });
  } catch (error) {
    console.error('Error populating series dropdowns:', error);
  }
}

export function renderMovieFilterBadges(activeMovieFilters, movieFilterBadges, movieActiveFilters) {
  if (!movieFilterBadges || !movieActiveFilters) return;
  
  if (activeMovieFilters.length === 0) {
    movieActiveFilters.classList.add('hidden');
    return;
  }
  
  movieActiveFilters.classList.remove('hidden');
  
  movieFilterBadges.innerHTML = activeMovieFilters.map((filter, index) => `
    <div class="px-3 py-1 bg-blue-600 rounded-md text-white text-sm font-medium flex items-center gap-2 group/badge cursor-pointer hover:bg-blue-700">
      <span>${escapeHtml(filter.name || filter.query || 'Filter')}</span>
      <span class="text-white font-bold hidden group-hover/badge:inline text-lg leading-none" data-filter-index="${index}">&times;</span>
    </div>
  `).join('');
  
  // Add click handlers for removing filters
  movieFilterBadges.querySelectorAll('[data-filter-index]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.filterIndex);
      document.dispatchEvent(new CustomEvent('removeMovieFilter', {
        detail: { index }
      }));
    });
  });
}

export function closeAllMovieDropdowns(movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown) {
  if (movieGenreDropdown) movieGenreDropdown.classList.add('hidden');
  if (movieKeywordsDropdown) movieKeywordsDropdown.classList.add('hidden');
  if (movieRatingDropdown) movieRatingDropdown.classList.add('hidden');
}

export function renderSeriesFilterBadges(activeSeriesFilters, seriesFilterBadges, seriesActiveFilters) {
  if (!seriesFilterBadges || !seriesActiveFilters) return;

  if (activeSeriesFilters.length === 0) {
    seriesActiveFilters.classList.add('hidden');
    return;
  }

  seriesActiveFilters.classList.remove('hidden');

  seriesFilterBadges.innerHTML = activeSeriesFilters.map((filter, index) => `
    <div class="px-3 py-1 bg-blue-600 rounded-md text-white text-sm font-medium flex items-center gap-2 group/badge cursor-pointer hover:bg-blue-700">
      <span>${escapeHtml(filter.name || filter.query || 'Filter')}</span>
      <span class="text-white font-bold hidden group-hover/badge:inline text-lg leading-none" data-filter-index="${index}">&times;</span>
    </div>
  `).join('');

  seriesFilterBadges.querySelectorAll('[data-filter-index]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.filterIndex, 10);
      document.dispatchEvent(new CustomEvent('removeSeriesFilter', {
        detail: { index }
      }));
    });
  });
}

export function closeAllSeriesDropdowns(seriesGenreDropdown, seriesStatusDropdown) {
  if (seriesGenreDropdown) seriesGenreDropdown.classList.add('hidden');
  if (seriesStatusDropdown) seriesStatusDropdown.classList.add('hidden');
}

export function filterSeriesByNetworks(seriesList, networkFilters) {
  if (!networkFilters || networkFilters.length === 0) return seriesList;
  const normalizedFilters = networkFilters.map(n => n.toLowerCase());
  return seriesList.filter(series => {
    const names = (series.networks || []).map(n => typeof n === 'string' ? n : n.name).map(n => String(n).toLowerCase());
    return normalizedFilters.some(filter => names.some(name => name.includes(filter)));
  });
}

export function filterSeriesByStatus(seriesList, statusFilter) {
  if (!statusFilter || Number.isFinite(Number(statusFilter.id))) return seriesList;
  const target = String(statusFilter.name || statusFilter.id || '').toLowerCase();
  if (!target) return seriesList;
  return seriesList.filter(series => {
    const status = series.status?.name || series.status || '';
    return String(status).toLowerCase().includes(target);
  });
}
