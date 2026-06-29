/**
 * Wires recommendation action buttons.
 */
export function setupRecommendationButtons({
  elements,
  switchPage,
  generateAlgorithmRecommendations,
  loadRecommendationsPage,
  getMyListPageMovies,
  getUserMovieList,
  getPageElements,
  getCurrentUser,
  getAppId,
  getAvailableMoviesForRecommendation
}) {
  const { aiRecommendationsBtn, movieRecommendationsBtn } = elements;

  if (aiRecommendationsBtn) {
    aiRecommendationsBtn.addEventListener('click', async () => {
      switchPage('recommendations');
      await generateAlgorithmRecommendations(
        getMyListPageMovies(),
        getUserMovieList(),
        getPageElements(),
        getAvailableMoviesForRecommendation()
      );
    });
  }

  if (movieRecommendationsBtn) {
    movieRecommendationsBtn.addEventListener('click', async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        switchPage('login-required');
        return;
      }
      await loadRecommendationsPage(
        getUserMovieList(),
        getMyListPageMovies(),
        getPageElements(),
        currentUser,
        getAppId()
      );
      switchPage('recommendations');
    });
  }
}
