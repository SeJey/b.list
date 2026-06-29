/**
 * Closes browse filter dropdowns when clicking outside filter containers.
 */
export function setupBrowseFilterOutsideClickHandler({
  closeAllMovieDropdowns,
  closeAllSeriesDropdowns,
  movieGenreDropdown,
  movieKeywordsDropdown,
  movieRatingDropdown,
  seriesGenreDropdown,
  seriesStatusDropdown
}) {
  document.addEventListener('click', (e) => {
    const movieFilterContainers = document.querySelectorAll('.movie-filter-dropdown');
    const seriesFilterContainers = document.querySelectorAll('.series-filter-dropdown');

    let clickedInside = false;
    movieFilterContainers.forEach((container) => {
      if (container.contains(e.target)) clickedInside = true;
    });
    seriesFilterContainers.forEach((container) => {
      if (container.contains(e.target)) clickedInside = true;
    });

    if (!clickedInside) {
      closeAllMovieDropdowns(movieGenreDropdown, movieKeywordsDropdown, movieRatingDropdown);
      closeAllSeriesDropdowns(seriesGenreDropdown, seriesStatusDropdown);
    }
  });
}
