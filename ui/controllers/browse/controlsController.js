/**
 * Wires browse page controls and filter-related custom events.
 */
export function setupBrowseControls({
  elements,
  fetchTMDb,
  normalizeMediaItem,
  renderMovieGrid,
  getActiveMovieFilters,
  setActiveMovieFilters,
  getActiveSeriesFilters,
  setActiveSeriesFilters,
  populateMovieDropdowns,
  populateSeriesDropdowns,
  renderMovieFilterBadges,
  renderSeriesFilterBadges,
  renderSeriesTagChips,
  loadMovieBrowseResults,
  loadSeriesBrowseResults,
  getPageElements,
  switchPage,
  showNotification
}) {
  const {
    movieGenreFilterBtn,
    movieGenreDropdown,
    movieKeywordsFilterBtn,
    movieKeywordsDropdown,
    movieRatingFilterBtn,
    movieRatingDropdown,
    movieBrowseSearchForm,
    movieBrowseSearchInput,
    movieBrowseGrid,
    movieBrowseResultsTitle,
    movieFilterBadges,
    movieActiveFilters,
    movieClearAllBtn,
    seriesGenreFilterBtn,
    seriesGenreDropdown,
    seriesStatusFilterBtn,
    seriesStatusDropdown,
    seriesBrowseSearchForm,
    seriesBrowseSearchInput,
    seriesBrowseResultsTitle,
    seriesFilterBadges,
    seriesActiveFilters,
    seriesClearAllBtn,
    seriesTagQuickPicks
  } = elements;

  const resolveMovieGenre = async (genreId, genreName) => {
    if (genreId) return { id: genreId, name: genreName || 'Genre' };

    const findOptionByName = () => {
      if (!genreName || !movieGenreDropdown) return null;
      return Array.from(movieGenreDropdown.querySelectorAll('.dropdown-option'))
        .find((option) => String(option.dataset.name || '').toLowerCase() === String(genreName).toLowerCase());
    };

    let option = findOptionByName();
    if (!option) {
      await populateMovieDropdowns(getActiveMovieFilters(), movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown);
      option = findOptionByName();
    }

    return option
      ? { id: option.dataset.id, name: option.dataset.name }
      : null;
  };

  const resolveSeriesGenreByIdOrName = async (genreId, genreName) => {
    if (genreId) return { type: 'genre', id: genreId, name: genreName || 'Genre' };
    return resolveSeriesGenre(genreName);
  };

  const findDropdownOptionByName = (dropdown, names) => {
    if (!dropdown) return null;
    const targets = (Array.isArray(names) ? names : [names])
      .filter(Boolean)
      .map((name) => String(name).toLowerCase());
    if (targets.length === 0) return null;
    return Array.from(dropdown.querySelectorAll('.dropdown-option'))
      .find((option) => targets.includes(String(option.dataset.name || '').toLowerCase()));
  };

  const resolveSeriesGenre = async (names) => {
    let option = findDropdownOptionByName(seriesGenreDropdown, names);
    if (!option) {
      await populateSeriesDropdowns(getActiveSeriesFilters(), seriesGenreDropdown, null, seriesStatusDropdown, null, null);
      option = findDropdownOptionByName(seriesGenreDropdown, names);
    }

    return option
      ? { type: 'genre', id: option.dataset.id, name: option.dataset.name }
      : null;
  };

  const resolveSeriesStatus = async (name, fallbackId) => {
    let option = findDropdownOptionByName(seriesStatusDropdown, name);
    if (!option) {
      await populateSeriesDropdowns(getActiveSeriesFilters(), seriesGenreDropdown, null, seriesStatusDropdown, null, null);
      option = findDropdownOptionByName(seriesStatusDropdown, name);
    }

    if (option) {
      return { type: 'status', id: option.dataset.id, name: option.dataset.name };
    }

    return fallbackId ? { type: 'status', id: fallbackId, name } : null;
  };

  const resolveSeriesTagFilters = async (tag) => {
    const resolved = [];

    for (const filter of tag.filters || []) {
      if (filter.type === 'genreAny') {
        const genre = await resolveSeriesGenre(filter.names);
        if (genre) resolved.push(genre);
      } else if (filter.type === 'statusName') {
        const status = await resolveSeriesStatus(filter.name, filter.fallbackId);
        if (status) resolved.push(status);
      } else {
        resolved.push(filter);
      }
    }

    return resolved;
  };

  const resolveMovieTagFilters = async (tag) => {
    if (Array.isArray(tag.filters) && tag.filters.length > 0) return tag.filters;
    if (tag.keywordId) {
      return [{ type: 'keyword', id: tag.keywordId, name: tag.name }];
    }

    const query = tag.searchName || tag.name;
    if (!query) return [];

    try {
      const data = await fetchTMDb('/search/keyword', `query=${encodeURIComponent(query)}`);
      const results = data.results || [];
      const exact = results.find(result => String(result.name || '').toLowerCase() === String(query).toLowerCase());
      const match = exact || results[0];
      return match?.id ? [{ type: 'keyword', id: match.id, name: tag.name || match.name }] : [];
    } catch (error) {
      console.error('Movie tag lookup failed:', error);
      return [];
    }
  };

  if (movieGenreFilterBtn) {
    movieGenreFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      movieGenreDropdown?.classList.toggle('hidden');
      movieKeywordsDropdown?.classList.add('hidden');
      movieRatingDropdown?.classList.add('hidden');
    });
  }

  if (movieKeywordsFilterBtn) {
    movieKeywordsFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      movieKeywordsDropdown?.classList.toggle('hidden');
      movieGenreDropdown?.classList.add('hidden');
      movieRatingDropdown?.classList.add('hidden');
    });
  }

  if (movieRatingFilterBtn) {
    movieRatingFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      movieRatingDropdown?.classList.toggle('hidden');
      movieGenreDropdown?.classList.add('hidden');
      movieKeywordsDropdown?.classList.add('hidden');
    });
  }

  if (movieBrowseSearchForm) {
    movieBrowseSearchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = movieBrowseSearchInput?.value.trim();
      if (!query) return;
      try {
        movieBrowseGrid.innerHTML = '<div class="col-span-full text-center text-gray-400">Loading...</div>';
        if (movieBrowseResultsTitle) movieBrowseResultsTitle.textContent = `Search: "${query}"`;
        const data = await fetchTMDb('/search/movie', `query=${encodeURIComponent(query)}`);
        const movies = (data.results || []).map((movie) => normalizeMediaItem(movie, 'movie'));
        if (movies.length === 0) {
          movieBrowseGrid.innerHTML = '<p class="text-gray-400 col-span-full text-center">No movies found</p>';
        } else {
          renderMovieGrid(movieBrowseGrid, movies, { clickAction: 'page', backPage: 'browse-movies' });
        }
        const nextFilters = [{ type: 'search', query, name: `Search: "${query}"` }];
        setActiveMovieFilters(nextFilters);
        renderMovieFilterBadges(nextFilters, movieFilterBadges, movieActiveFilters);
      } catch (error) {
        console.error('Error searching movies:', error);
        movieBrowseGrid.innerHTML = '<p class="text-gray-400 col-span-full text-center">Error searching movies</p>';
      }
    });
  }

  if (movieClearAllBtn) {
    movieClearAllBtn.addEventListener('click', async () => {
      setActiveMovieFilters([]);
      if (movieBrowseSearchInput) movieBrowseSearchInput.value = '';
      await populateMovieDropdowns([], movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown);
      renderMovieFilterBadges([], movieFilterBadges, movieActiveFilters);
      await loadMovieBrowseResults([], getPageElements());
    });
  }

  if (seriesGenreFilterBtn) {
    seriesGenreFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      seriesGenreDropdown?.classList.toggle('hidden');
      seriesStatusDropdown?.classList.add('hidden');
    });
  }

  if (seriesStatusFilterBtn) {
    seriesStatusFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      seriesStatusDropdown?.classList.toggle('hidden');
      seriesGenreDropdown?.classList.add('hidden');
    });
  }

  if (seriesBrowseSearchForm) {
    seriesBrowseSearchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = seriesBrowseSearchInput?.value.trim();
      if (!query) return;
      const searchName = `Search: "${query}"`;
      const nextFilters = [{ type: 'search', query, name: searchName }];
      setActiveSeriesFilters(nextFilters);
      await populateSeriesDropdowns(nextFilters, seriesGenreDropdown, null, seriesStatusDropdown, null, null);
      renderSeriesTagChips?.(nextFilters, seriesTagQuickPicks);
      renderSeriesFilterBadges?.(nextFilters, seriesFilterBadges, seriesActiveFilters);
      await loadSeriesBrowseResults(nextFilters, getPageElements());
    });
  }

  if (seriesClearAllBtn) {
    seriesClearAllBtn.addEventListener('click', async () => {
      setActiveSeriesFilters([]);
      if (seriesBrowseSearchInput) seriesBrowseSearchInput.value = '';
      if (seriesBrowseResultsTitle) seriesBrowseResultsTitle.textContent = 'Popular Series';
      await populateSeriesDropdowns([], seriesGenreDropdown, null, seriesStatusDropdown, null, null);
      renderSeriesTagChips?.([], seriesTagQuickPicks);
      renderSeriesFilterBadges?.([], seriesFilterBadges, seriesActiveFilters);
      await loadSeriesBrowseResults([], getPageElements());
    });
  }

  document.addEventListener('applyMovieFilter', async (e) => {
    const { type, id, name } = e.detail;
    const current = getActiveMovieFilters().filter((f) => f.type !== 'search');
    const existingIndex = current.findIndex((f) => f.type === type && f.id == id);

    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
    } else {
      current.push({ type, id, name });
    }

    setActiveMovieFilters(current);
    await populateMovieDropdowns(current, movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown);
    renderMovieFilterBadges(current, movieFilterBadges, movieActiveFilters);
    await loadMovieBrowseResults(current, getPageElements());
  });

  document.addEventListener('applyMovieTag', async (e) => {
    const tag = e.detail?.tag;
    if (!tag) return;

    const current = getActiveMovieFilters().filter((f) => f.type !== 'search');
    const existingIndex = current.findIndex((f) => f.type === 'movieTag' && String(f.id) === String(tag.id));

    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
    } else {
      const filters = await resolveMovieTagFilters(tag);
      if (filters.length === 0) {
        showNotification?.('No matching tag found.', true);
        return;
      }
      current.push({ type: 'movieTag', id: tag.id, name: tag.name, filters });
    }

    setActiveMovieFilters(current);
    await populateMovieDropdowns(current, movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown);
    renderMovieFilterBadges(current, movieFilterBadges, movieActiveFilters);
    await loadMovieBrowseResults(current, getPageElements());
  });

  document.addEventListener('removeMovieFilter', async (e) => {
    const { index } = e.detail;
    const current = [...getActiveMovieFilters()];
    current.splice(index, 1);
    setActiveMovieFilters(current);
    await populateMovieDropdowns(current, movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown);
    renderMovieFilterBadges(current, movieFilterBadges, movieActiveFilters);
    await loadMovieBrowseResults(current, getPageElements());
  });

  document.addEventListener('applySeriesFilter', async (e) => {
    const { type, id, name } = e.detail;
    const current = getActiveSeriesFilters().filter((f) => f.type !== 'search');
    const existingIndex = current.findIndex((f) => f.type === type && f.id == id);

    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
    } else {
      current.push({ type, id, name });
    }

    setActiveSeriesFilters(current);
    await populateSeriesDropdowns(current, seriesGenreDropdown, null, seriesStatusDropdown, null, null);
    renderSeriesTagChips?.(current, seriesTagQuickPicks);
    renderSeriesFilterBadges?.(current, seriesFilterBadges, seriesActiveFilters);
    await loadSeriesBrowseResults(current, getPageElements());
  });

  document.addEventListener('applySeriesTag', async (e) => {
    const tag = e.detail?.tag;
    if (!tag) return;

    const current = getActiveSeriesFilters().filter((f) => f.type !== 'search');
    const existingIndex = current.findIndex((f) => f.type === 'seriesTag' && String(f.id) === String(tag.id));

    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
    } else {
      const filters = await resolveSeriesTagFilters(tag);
      current.push({ type: 'seriesTag', id: tag.id, name: tag.name, filters });
    }

    setActiveSeriesFilters(current);
    await populateSeriesDropdowns(current, seriesGenreDropdown, null, seriesStatusDropdown, null, null);
    renderSeriesTagChips?.(current, seriesTagQuickPicks);
    renderSeriesFilterBadges?.(current, seriesFilterBadges, seriesActiveFilters);
    await loadSeriesBrowseResults(current, getPageElements());
  });

  document.addEventListener('removeSeriesFilter', async (e) => {
    const { index } = e.detail;
    const current = [...getActiveSeriesFilters()];
    current.splice(index, 1);
    setActiveSeriesFilters(current);
    await populateSeriesDropdowns(current, seriesGenreDropdown, null, seriesStatusDropdown, null, null);
    renderSeriesTagChips?.(current, seriesTagQuickPicks);
    renderSeriesFilterBadges?.(current, seriesFilterBadges, seriesActiveFilters);
    await loadSeriesBrowseResults(current, getPageElements());
  });

  document.addEventListener('selectGenre', async (e) => {
    const { genreId, genreName, mediaType } = e.detail || {};

    if (mediaType === 'series' || mediaType === 'tv') {
      const genre = await resolveSeriesGenreByIdOrName(genreId, genreName);
      if (!genre?.id) return;

      const nextFilters = [{ type: 'genre', id: genre.id, name: genre.name || genreName || 'Genre' }];
      setActiveSeriesFilters(nextFilters);
      switchPage('browse-series');
      await populateSeriesDropdowns(nextFilters, seriesGenreDropdown, null, seriesStatusDropdown, null, null);
      renderSeriesTagChips?.(nextFilters, seriesTagQuickPicks);
      renderSeriesFilterBadges?.(nextFilters, seriesFilterBadges, seriesActiveFilters);
      await loadSeriesBrowseResults(nextFilters, getPageElements());
      return;
    }

    const genre = await resolveMovieGenre(genreId, genreName);
    if (!genre?.id) return;

    const nextFilters = [{ type: 'genre', id: genre.id, name: genre.name || genreName || 'Genre' }];
    setActiveMovieFilters(nextFilters);
    switchPage('browse-movies');
    await populateMovieDropdowns(nextFilters, movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown);
    renderMovieFilterBadges(nextFilters, movieFilterBadges, movieActiveFilters);
    await loadMovieBrowseResults(nextFilters, getPageElements());
  });
}
