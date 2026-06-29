/**
 * Wires CustomEvent navigation emitted from UI modules.
 */
export function setupCustomNavigateHandler({ switchPage, updateHomePageView }) {
  document.addEventListener('navigate', (e) => {
    const page = e.detail?.page;
    if (!page) return;
    switchPage(page);
    if (page === 'home') updateHomePageView();
  });
}
