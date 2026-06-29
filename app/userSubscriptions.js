export function createUserSubscriptions({
  state,
  elements,
  subscribeToUserMovies,
  loadMyListPage,
  updateProfileStats,
  updateProfileLists,
  renderHomeInProgressSections
}) {
  function setupFirestoreListener() {
    if (typeof state.firestoreUnsubscribe === 'function') {
      state.firestoreUnsubscribe();
      state.firestoreUnsubscribe = null;
    }

    if (!state.currentUser) {
      state.userMovieList = new Map();
      if (state.currentPage === 'my-list') {
        loadMyListPage(
          state.userMovieList,
          state.myListPageMovies,
          {
            myListGrid: elements.myList.grid,
            myListFilters: elements.myList.filters,
            myListSortRatingBtn: elements.myList.sortRatingBtn,
            loader: elements.ui.loader
          },
          state.currentUser
        );
      }
      updateProfileStats({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });
      updateProfileLists({ userMovieList: state.userMovieList });
      renderHomeInProgressSections();
      return;
    }

    state.firestoreUnsubscribe = subscribeToUserMovies(state.appId, state.currentUser.uid, (latestMap) => {
      state.userMovieList = latestMap;
      if (state.currentPage === 'my-list') {
        loadMyListPage(
          state.userMovieList,
          state.myListPageMovies,
          {
            myListGrid: elements.myList.grid,
            myListFilters: elements.myList.filters,
            myListSortRatingBtn: elements.myList.sortRatingBtn,
            loader: elements.ui.loader
          },
          state.currentUser
        );
      }
      updateProfileStats({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });
      updateProfileLists({ userMovieList: state.userMovieList });
      renderHomeInProgressSections();
    });
  }

  return { setupFirestoreListener };
}
