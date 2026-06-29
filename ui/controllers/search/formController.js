/**
 * Wires home and search-page form interactions.
 */
export function setupSearchFormHandlers({
  elements,
  switchPage,
  loadSearchResultsPage,
  loadHomePageContent,
  getPageElements
}) {
  const {
    homeSearchForm,
    homeSearchInput,
    searchPageForm,
    searchPageInput
  } = elements;

  if (homeSearchForm) {
    homeSearchForm.addEventListener('click', () => homeSearchInput?.focus());
    homeSearchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = homeSearchInput.value.trim();
      if (query) {
        switchPage('search');
        await loadSearchResultsPage(query, getPageElements());
      }
    });
  }

  if (homeSearchInput) {
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
        event.preventDefault();
        homeSearchInput.focus();
      }
    });
  }

  if (searchPageForm) {
    searchPageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = searchPageInput.value.trim();
      if (query) await loadSearchResultsPage(query, getPageElements());
    });
  }
}
