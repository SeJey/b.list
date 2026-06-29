export function createRouter({
  state,
  elements,
  getPageElements,
  loadUserPlaylists,
  updateProfileStats,
  updateProfileLists
}) {
  const protectedPages = new Set(['my-list', 'playlists', 'profile', 'user-profile', 'settings', 'notifications', 'forum']);

  function switchPage(page) {
    const allPages = Object.values(elements.pages).filter(Boolean);

    allPages.forEach((el) => el.classList.add('hidden'));
    [elements.nav.home, elements.nav.myList, elements.nav.browse, elements.nav.movies, elements.nav.series, elements.nav.forum].forEach((link) => {
      link?.classList.remove('active');
    });

    if (protectedPages.has(page) && !state.currentUser) {
      elements.pages.loginRequired?.classList.remove('hidden');
      return;
    }

    state.currentPage = page;

    const pageMap = {
      home: elements.pages.home,
      search: elements.pages.search,
      'my-list': elements.pages.myList,
      'browse-movies': elements.pages.browseMovies,
      'browse-series': elements.pages.browseSeries,
      playlists: elements.pages.playlists,
      forum: elements.pages.forum,
      recommendations: elements.pages.recommendations,
      profile: elements.pages.profile,
      'user-profile': elements.pages.userProfile,
      actor: elements.pages.actor,
      movie: elements.pages.movie,
      settings: elements.pages.settings,
      notifications: elements.pages.notifications,
      'login-required': elements.pages.loginRequired,
      auth: elements.pages.auth
    };

    pageMap[page]?.classList.remove('hidden');

    if (page === 'user-profile' && state.currentUser) {
      updateProfileStats({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });
      updateProfileLists({ userMovieList: state.userMovieList });
    }

    if (page === 'playlists' && state.currentUser) {
      void loadUserPlaylists(state.appId, state.currentUser.uid, getPageElements(), state.userMovieList);
    }

    if (page === 'home' || page === 'activity') elements.nav.home?.classList.add('active');
    if (page === 'my-list') elements.nav.myList?.classList.add('active');
    if (page === 'browse-movies') (elements.nav.movies || elements.nav.browse)?.classList.add('active');
    if (page === 'browse-series') (elements.nav.series || elements.nav.browse)?.classList.add('active');
    if (page === 'forum') elements.nav.forum?.classList.add('active');
  }

  return { switchPage };
}
