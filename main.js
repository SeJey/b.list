import './config.js';
import { loadSettings, saveSettings, applyTheme, settings } from './settings.js';
import { setupAuthStateListener } from './auth.js';
import { fetchTMDb } from './api/tmdb.js';
import { callGeminiApi } from './api/ai.js';
import {
  updateMovieStatus,
  removeMovieFromList,
  removeAggregateRating,
  getMovieAggregateRating,
  subscribeToMovieAggregateRating,
  subscribeToUserMovies,
  updateUserRating,
  updateWatchTime,
  updateEpisodesWatched,
  createPlaylist,
  upsertFollowedPerson,
  removeFollowedPerson,
  subscribeToUserFollowing,
  upsertPublicUserProfile,
  subscribeToSuggestedUsers,
  upsertFollowedUser,
  removeFollowedUser,
  subscribeToUserFollows,
  createForumPost,
  subscribeToForumPosts,
  createForumComment,
  subscribeToForumComments,
  upsertMovieReview,
  subscribeToMovieReviews,
  publishActivityEvent,
  subscribeToActivityEvents,
  deleteUserActivityEvents,
  updateActivitySharingPreference,
  patchUserMovieAnalytics
} from './storage.js';
import {
  showNotification,
  renderMovieGrid,
  renderMovieListView,
  openMovieModal,
  closeMovieModal,
  showActorPage,
  showMoviePage
} from './ui/ui.js';
import { getUserInitials } from './utils/helpers.js';
import { normalizeMediaItem, buildTvdbCredits } from './utils/mediaData.js';
import { state } from './app/state.js';
import { createUserSubscriptions } from './app/userSubscriptions.js';
import { createActivitySubscriptions } from './app/activitySubscriptions.js';
import { createProfileMetadataBackfill } from './app/profileMetadata.js';
import { getDomElements, getPageElements as buildPageElements } from './ui/dom.js';
import { createRouter } from './ui/router.js';
import { loadHomePageContent, createHomeController } from './ui/pages/homePage.js';
import { createActivityPageController } from './ui/pages/activityPage.js';
import { selectProfileTab, setupProfileTabs, updateProfileStats, updateProfileLists, setProfileStatsEnrichment } from './ui/pages/profilePage.js';
import { loadSearchResultsPage } from './ui/pages/searchPage.js';
import { loadMyListPage, renderMyListFilters, filterMyList } from './ui/pages/myListPage.js';
import { loadBrowseMoviesPage, loadMovieBrowseResults, loadBrowseSeriesPage, loadSeriesBrowseResults } from './ui/pages/browsePage.js';
import { loadRecommendationsPage, loadUserPlaylists, generateAlgorithmRecommendations } from './ui/pages/recommendationsPage.js';
import { createForumPageController } from './ui/pages/forumPage.js';
import { setupAuthFormHandlers } from './ui/pages/authPage.js';
import { renderAuthUI } from './ui/controllers/auth/headerController.js';
import { setupSettingsControls } from './ui/controllers/settings/controlsController.js';
import { createFollowingController } from './ui/controllers/following/peopleController.js';
import { createUserSocialController } from './ui/controllers/social/usersController.js';
import { createMediaListActionsController } from './ui/controllers/media/listActionsController.js';
import { setupGlobalEventListeners } from './ui/controllers/globalEventsController.js';
import { setupProfileMenuHandlers } from './ui/controllers/profile/menuController.js';
import { setupModalShellHandlers } from './ui/controllers/modal/shellController.js';
import { setupActorInteractionHandlers } from './ui/controllers/actor/interactionController.js';
import { setupBrowseFilterOutsideClickHandler } from './ui/controllers/browse/filterOutsideClickController.js';
import { setupCustomNavigateHandler } from './ui/controllers/navigation/customNavigateController.js';
import { setupTopNavAndBrowseHandlers } from './ui/controllers/navigation/topNavController.js';
import { setupPlaylistModalHandlers } from './ui/controllers/playlists/modalController.js';
import { setupActivityTabBindings } from './ui/controllers/activity/tabBindingsController.js';
import { setupSearchFormHandlers } from './ui/controllers/search/formController.js';
import { setupMyListControls } from './ui/controllers/myList/controlsController.js';
import { setupBrowseControls } from './ui/controllers/browse/controlsController.js';
import { setupMediaCardEventHandlers } from './ui/controllers/media/cardEventsController.js';
import { setupRecommendationButtons } from './ui/controllers/recommendations/buttonsController.js';
import {
  populateMovieDropdowns,
  populateSeriesDropdowns,
  renderMovieFilterBadges,
  renderSeriesFilterBadges,
  renderSeriesTagChips,
  closeAllMovieDropdowns,
  closeAllSeriesDropdowns
} from './ui/components/filters.js';

loadSettings();
applyTheme(settings.theme);

state.appId = (typeof __app_id !== 'undefined') ? __app_id : (settings.appId || 'blist-default-app');

const elements = getDomElements();
const getPageElements = () => buildPageElements(elements);

let activityController;

const { switchPage } = createRouter({
  state,
  elements,
  getPageElements,
  loadUserPlaylists,
  updateProfileStats,
  updateProfileLists
});

const followingController = createFollowingController({
  state,
  fetchTMDb,
  subscribeToUserFollowing,
  upsertFollowedPerson,
  removeFollowedPerson,
  updateProfileStats,
  showNotification,
  loadHomeActivityContent: (tabName) => activityController?.loadHomeActivityContent(tabName)
});

const userSocialController = createUserSocialController({
  state,
  subscribeToUserFollows,
  subscribeToSuggestedUsers,
  upsertFollowedUser,
  removeFollowedUser,
  updateProfileStats,
  showNotification
});

activityController = createActivityPageController({
  state,
  elements,
  buildFollowingHtml: followingController.buildFollowingHtml,
  updateFollowButtonsState: followingController.updateFollowButtonsState,
  updateFollowUserButtonsState: userSocialController.updateFollowUserButtonsState
});

const activitySubscriptions = createActivitySubscriptions({
  state,
  subscribeToActivityEvents,
  onActivityChanged: activityController.refreshActivityFeeds
});

const forumController = createForumPageController({
  state,
  elements,
  createForumPost,
  subscribeToForumPosts,
  createForumComment,
  subscribeToForumComments,
  showNotification,
  getFollowedUserIds: userSocialController.getFollowedUserIds,
  updateFollowUserButtonsState: userSocialController.updateFollowUserButtonsState
});

const homeController = createHomeController({
  state,
  elements,
  getPageElements,
  loadHomeActivityContent: activityController.loadHomeActivityContent,
  updateMovieStatus
});

elements.home.guestJoinBtn?.addEventListener('click', () => switchPage('auth'));
elements.home.recommendationsLink?.addEventListener('click', async () => {
  switchPage('recommendations');
  await loadRecommendationsPage(state.userMovieList, state.myListPageMovies, getPageElements(), state.currentUser, state.appId);
});

const userSubscriptions = createUserSubscriptions({
  state,
  elements,
  subscribeToUserMovies,
  loadMyListPage,
  updateProfileStats,
  updateProfileLists,
  renderHomeInProgressSections: homeController.renderHomeInProgressSections
});

async function publishUserActivity({ type, movieId, media = {}, rating = null, season = null, episode = null }) {
  if (!state.currentUser || state.currentUserProfile?.shareActivity === false) return null;
  const profile = state.currentUserProfile || {};
  const activityUser = {
    uid: state.currentUser.uid,
    displayName: profile.displayName || profile.username || state.currentUser.displayName || 'Blist Member',
    email: state.currentUser.email || '',
    photoURL: profile.photoURL || state.currentUser.photoURL || '',
    initials: profile.initials || ''
  };
  return publishActivityEvent(state.appId, activityUser, {
    type,
    mediaId: String(movieId),
    mediaType: media.type === 'series' || media.media_type === 'tv' ? 'series' : 'movie',
    mediaTitle: media.title || media.name || 'Untitled',
    mediaPosterPath: media.poster_path || '',
    rating,
    season,
    episode,
    visibility: profile.activityVisibility || settings.privacy?.activityVisibility || 'public'
  });
}

const profileMetadataBackfill = createProfileMetadataBackfill({
  state,
  fetchTMDb,
  normalizeMediaItem,
  patchUserMovieAnalytics,
  updateProfileStats,
  updateProfileLists,
  setProfileStatsEnrichment
});

const mediaListActions = createMediaListActionsController({
  state,
  elements,
  settings,
  switchPage,
  showNotification,
  updateMovieStatus,
  updateUserRating,
  updateWatchTime,
  updateEpisodesWatched,
  removeMovieFromList,
  removeAggregateRating,
  renderMyListFilters,
  filterMyList,
  publishActivity: publishUserActivity
});

const renderHeaderAuth = () => renderAuthUI({
  state,
  elements,
  settings,
  switchPage,
  getUserInitials,
  updateProfileStats,
  updateProfileLists
});

const settingsControls = setupSettingsControls({
  state,
  elements,
  settings,
  applyTheme,
  saveSettings,
  updateProfileStats,
  filterMyList,
  updateActivitySharingPreference,
  showNotification,
  renderHeaderAuth: () => renderHeaderAuth(),
  upsertPublicUserProfile,
  updateMovieStatus,
  fetchTMDb,
  loadMyListPage,
  deleteUserActivityEvents
});

activityController.setupProfileActivityBindings();
setupProfileTabs({
  onTabChange: tabName => {
    if (tabName === 'stats') void profileMetadataBackfill.backfill();
    if (tabName === 'activity') activityController.refreshActivityFeeds();
  }
});

setupAuthStateListener((user) => {
  state.currentUser = user;
  state.currentUserProfile = null;
  if (user) {
    const hasSavedProfile = Boolean(settings.userProfiles?.[user.uid]);
    const savedProfile = { ...(settings.profile || {}), ...(settings.userProfiles?.[user.uid] || {}) };
    void upsertPublicUserProfile(state.appId, {
      ...user,
      displayName: savedProfile.displayName || user.displayName,
      photoURL: savedProfile.avatarCleared ? '' : (savedProfile.avatarDataUrl || savedProfile.avatarUrl || user.photoURL),
      email: settings.privacy?.showEmailOnProfile === false ? '' : user.email,
      bio: savedProfile.bio || '',
      publicProfile: settings.privacy?.publicProfile !== false,
      shareActivity: settings.privacy?.shareActivity !== false,
      activityVisibility: settings.privacy?.activityVisibility || 'public',
      preserveExistingPrivacy: true,
      preferLocalProfile: hasSavedProfile
    }).then(profile => {
      if (state.currentUser?.uid !== user.uid) return;
      state.currentUserProfile = profile;
      settings.privacy.shareActivity = profile?.shareActivity !== false;
      settings.privacy.activityVisibility = profile?.activityVisibility || 'public';
      settings.privacy.publicProfile = profile?.publicProfile !== false;
      settings.privacy.showEmailOnProfile = Boolean(profile?.email);
      saveSettings();
      renderHeaderAuth();
      settingsControls.refreshSettingsForm?.();
      settingsControls.syncActivitySharingToggle();
    });
  }
  renderHeaderAuth();
  settingsControls.refreshSettingsForm?.();
  userSubscriptions.setupFirestoreListener();
  followingController.setupFollowingListener();
  userSocialController.setupUserFollowsListener();
  userSocialController.setupSuggestedUsersListener();
  activitySubscriptions.start();
  settingsControls.syncActivitySharingToggle();
  if (!user) forumController.clearForumSubscriptions();
  homeController.updateHomePageView();
  updateProfileLists({ userMovieList: state.userMovieList });
  switchPage('home');
});

setupPlaylistModalHandlers({
  elements: {
    createPlaylistBtn: elements.playlists.createBtn,
    createPlaylistMainBtn: elements.playlists.createMainBtn,
    createPlaylistModal: elements.playlists.modal,
    createPlaylistForm: elements.playlists.form,
    playlistNameInput: elements.playlists.nameInput,
    playlistDescriptionInput: elements.playlists.descriptionInput,
    playlistPublicCheckbox: elements.playlists.publicCheckbox,
    closePlaylistModalBtn: elements.playlists.closeModalBtn,
    cancelPlaylistBtn: elements.playlists.cancelBtn
  },
  createPlaylist,
  getAppId: () => state.appId,
  getCurrentUser: () => state.currentUser,
  showNotification
});

setupTopNavAndBrowseHandlers({
  elements: {
    navHome: elements.nav.home,
    navMyList: elements.nav.myList,
    navForum: elements.nav.forum,
    browseDropdown: elements.browseMenu.dropdown,
    browseMenuMovies: elements.browseMenu.movies,
    browseMenuSeries: elements.browseMenu.series,
    browseMenuActors: elements.browseMenu.actors,
    browseMenuDirectors: elements.browseMenu.directors
  },
  onHomeClick: () => {
    switchPage('home');
    homeController.updateHomePageView();
  },
  onMyListClick: () => {
    switchPage('my-list');
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
  },
  onForumClick: () => {
    switchPage('forum');
    forumController.loadForumPage();
  },
  onBrowseMoviesClick: () => {
    switchPage('browse-movies');
    loadBrowseMoviesPage(state.activeMovieFilters, getPageElements());
  },
  onBrowseSeriesClick: () => {
    switchPage('browse-series');
    loadBrowseSeriesPage(state.activeSeriesFilters, getPageElements());
  },
  onBrowseActorsClick: () => {
    showNotification('Actor browsing coming soon!', true);
  },
  onBrowseDirectorsClick: () => {
    showNotification('Director browsing coming soon!', true);
  }
});

setupActivityTabBindings({
  activityTabs: elements.activity.tabs,
  homeActivityTabs: elements.activity.homeTabs,
  setActivityTab: activityController.setActivityTab,
  setHomeActivityTab: activityController.setHomeActivityTab
});

setupSearchFormHandlers({
  elements: {
    homeSearchForm: elements.home.searchForm,
    homeSearchInput: elements.home.searchInput,
    searchPageForm: elements.search.form,
    searchPageInput: elements.search.input
  },
  switchPage,
  loadSearchResultsPage,
  loadHomePageContent,
  getPageElements
});

setupMyListControls({
  elements: {
    myListSearchInput: elements.myList.searchInput,
    myListGrid: elements.myList.grid,
    myListSortRatingBtn: elements.myList.sortRatingBtn,
    myListFilters: elements.myList.filters
  },
  getMyListPageMovies: () => state.myListPageMovies,
  getUserMovieList: () => state.userMovieList,
  renderMovieListView,
  filterMyList,
  renderMyListFilters
});

setupBrowseControls({
  elements: {
    movieGenreFilterBtn: elements.browseMovies.genreFilterBtn,
    movieGenreDropdown: elements.browseMovies.genreDropdown,
    movieKeywordsFilterBtn: elements.browseMovies.keywordsFilterBtn,
    movieKeywordsDropdown: elements.browseMovies.keywordsDropdown,
    movieRatingFilterBtn: elements.browseMovies.ratingFilterBtn,
    movieRatingDropdown: elements.browseMovies.ratingDropdown,
    movieBrowseSearchForm: elements.browseMovies.searchForm,
    movieBrowseSearchInput: elements.browseMovies.searchInput,
    movieBrowseGrid: elements.browseMovies.grid,
    movieBrowseResultsTitle: elements.browseMovies.resultsTitle,
    movieFilterBadges: elements.browseMovies.filterBadges,
    movieActiveFilters: elements.browseMovies.activeFilters,
    movieClearAllBtn: elements.browseMovies.clearAllBtn,
    seriesGenreFilterBtn: elements.browseSeries.genreFilterBtn,
    seriesGenreDropdown: elements.browseSeries.genreDropdown,
    seriesStatusFilterBtn: elements.browseSeries.statusFilterBtn,
    seriesStatusDropdown: elements.browseSeries.statusDropdown,
    seriesBrowseSearchForm: elements.browseSeries.searchForm,
    seriesBrowseSearchInput: elements.browseSeries.searchInput,
    seriesBrowseResultsTitle: elements.browseSeries.resultsTitle,
    seriesFilterBadges: elements.browseSeries.filterBadges,
    seriesActiveFilters: elements.browseSeries.activeFilters,
    seriesClearAllBtn: elements.browseSeries.clearAllBtn,
    seriesTagQuickPicks: elements.browseSeries.tagQuickPicks
  },
  fetchTMDb,
  normalizeMediaItem,
  renderMovieGrid,
  getActiveMovieFilters: () => state.activeMovieFilters,
  setActiveMovieFilters: (next) => { state.activeMovieFilters = next; },
  getActiveSeriesFilters: () => state.activeSeriesFilters,
  setActiveSeriesFilters: (next) => { state.activeSeriesFilters = next; },
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
});

setupBrowseFilterOutsideClickHandler({
  closeAllMovieDropdowns,
  closeAllSeriesDropdowns,
  movieGenreDropdown: elements.browseMovies.genreDropdown,
  movieKeywordsDropdown: elements.browseMovies.keywordsDropdown,
  movieRatingDropdown: elements.browseMovies.ratingDropdown,
  seriesGenreDropdown: elements.browseSeries.genreDropdown,
  seriesStatusDropdown: elements.browseSeries.statusDropdown
});

setupProfileMenuHandlers({
  switchPage,
  onProfileOpen: () => {
    selectProfileTab('overview');
    updateProfileStats({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });
    updateProfileLists({ userMovieList: state.userMovieList });
  },
  onLogoutSuccess: () => {
    state.currentUser = null;
    state.currentUserProfile = null;
    state.userMovieList.clear();
    state.userFollowing.clear();
    state.followingProjectsCache.clear();
    state.userFollows.clear();
    forumController.clearForumSubscriptions();
    renderHeaderAuth();
  }
});

setupAuthFormHandlers();
setupModalShellHandlers({ closeMovieModal });

setupActorInteractionHandlers({
  fetchTMDb,
  closeMovieModal,
  switchPage,
  showActorPage,
  updateFollowButtonsState: followingController.updateFollowButtonsState,
  actorPage: elements.pages.actor,
  showNotification
});

setupCustomNavigateHandler({
  switchPage,
  updateHomePageView: homeController.updateHomePageView
});

setupMediaCardEventHandlers({
  fetchTMDb,
  normalizeMediaItem,
  buildTvdbCredits,
  openMovieModal,
  showMoviePage,
  callGeminiApi,
  settings,
  getUserMovieList: () => state.userMovieList,
  getRatingSummary: (movieId) => getMovieAggregateRating(state.appId, movieId),
  subscribeRatingSummary: (movieId, callback) => subscribeToMovieAggregateRating(state.appId, movieId, callback),
  subscribeToMovieReviews: (movieId, callback) => subscribeToMovieReviews(state.appId, movieId, callback),
  upsertMovieReview: async (movieId, mediaData, reviewData) => {
    const result = await upsertMovieReview(state.appId, state.currentUser, movieId, mediaData, reviewData);
    void publishUserActivity({ type: 'reviewed', movieId, media: mediaData, rating: reviewData.rating || null });
    return result;
  },
  setCurrentModalData: (media, credits) => {
    state.currentModalMovie = media;
    state.currentModalCredits = credits;
  },
  updateFollowButtonsState: followingController.updateFollowButtonsState,
  updateFollowUserButtonsState: userSocialController.updateFollowUserButtonsState,
  showNotification,
  switchPage,
  getCurrentUser: () => state.currentUser,
  localUpdateMovieStatus: mediaListActions.localUpdateMovieStatus,
  localUpdateUserRating: mediaListActions.localUpdateUserRating,
  localUpdateWatchTime: mediaListActions.localUpdateWatchTime,
  localUpdateEpisodes: mediaListActions.localUpdateEpisodes,
  localRemoveMovie: mediaListActions.localRemoveMovie
});

document.addEventListener('filterMyList', (event) => {
  const { status } = event.detail;
  filterMyList(
    status,
    state.myListPageMovies,
    state.userMovieList,
    elements.myList.grid,
    elements.myList.sortRatingBtn?.dataset.sortMode || 'added'
  );
});

setupRecommendationButtons({
  elements: {
    aiRecommendationsBtn: elements.recommendations.aiButton,
    movieRecommendationsBtn: elements.browseMovies.recommendationsBtn
  },
  switchPage,
  generateAlgorithmRecommendations,
  loadRecommendationsPage,
  getMyListPageMovies: () => state.myListPageMovies,
  getUserMovieList: () => state.userMovieList,
  getPageElements,
  getCurrentUser: () => state.currentUser,
  getAppId: () => state.appId,
  getAvailableMoviesForRecommendation: () => state.availableMoviesForRecommendation
});

setupGlobalEventListeners({
  toggleFollowPerson: followingController.toggleFollowPerson,
  toggleFollowUser: userSocialController.toggleFollowUser
});

document.addEventListener('blist:socialUsersChanged', () => activityController.refreshActivityFeeds());
