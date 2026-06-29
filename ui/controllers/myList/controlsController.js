/**
 * Wires My List page search and sort controls.
 */
export function setupMyListControls({
  elements,
  getMyListPageMovies,
  getUserMovieList,
  renderMovieListView,
  filterMyList,
  renderMyListFilters
}) {
  const {
    myListSearchInput,
    myListGrid,
    myListSortRatingBtn,
    myListFilters
  } = elements;

  if (myListSearchInput) {
    myListSearchInput.addEventListener('input', () => {
      const query = myListSearchInput.value.trim().toLowerCase();
      const filtered = getMyListPageMovies().filter((movie) => movie.title.toLowerCase().includes(query));
      renderMovieListView(myListGrid, filtered, getUserMovieList(), {
        showStatus: true,
        sortMode: myListSortRatingBtn?.dataset.sortMode || 'added'
      });
    });
  }

  if (myListSortRatingBtn) {
    myListSortRatingBtn.addEventListener('click', () => {
      const nextSortMode = myListSortRatingBtn.dataset.sortMode === 'rating' ? 'added' : 'rating';
      myListSortRatingBtn.dataset.sortMode = nextSortMode;
      const activeFilter = document.querySelector('#my-list-filters .filter-btn.active')?.dataset.status || 'all';
      filterMyList(activeFilter, getMyListPageMovies(), getUserMovieList(), myListGrid, nextSortMode);
      renderMyListFilters(myListFilters, activeFilter);
    });
  }
}
