/**
 * Wires create-playlist modal open/close and form submit handlers.
 */
export function setupPlaylistModalHandlers({
  elements,
  createPlaylist,
  getAppId,
  getCurrentUser,
  showNotification
}) {
  const {
    createPlaylistBtn,
    createPlaylistMainBtn,
    createPlaylistModal,
    createPlaylistForm,
    playlistNameInput,
    playlistDescriptionInput,
    playlistPublicCheckbox,
    closePlaylistModalBtn,
    cancelPlaylistBtn
  } = elements;

  function openPlaylistModal() {
    if (createPlaylistModal) {
      createPlaylistModal.classList.remove('hidden');
      createPlaylistModal.classList.add('flex');
      if (playlistNameInput) playlistNameInput.focus();
    }
  }

  function closePlaylistModal() {
    if (createPlaylistModal) {
      createPlaylistModal.classList.add('hidden');
      createPlaylistModal.classList.remove('flex');
    }
    if (createPlaylistForm) createPlaylistForm.reset();
  }

  if (createPlaylistBtn) createPlaylistBtn.addEventListener('click', openPlaylistModal);
  if (createPlaylistMainBtn) createPlaylistMainBtn.addEventListener('click', openPlaylistModal);
  if (closePlaylistModalBtn) closePlaylistModalBtn.addEventListener('click', closePlaylistModal);
  if (cancelPlaylistBtn) cancelPlaylistBtn.addEventListener('click', closePlaylistModal);

  if (createPlaylistModal) {
    createPlaylistModal.addEventListener('click', (e) => {
      if (e.target === createPlaylistModal) closePlaylistModal();
    });
  }

  if (createPlaylistForm) {
    createPlaylistForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentUser = getCurrentUser();
      if (!currentUser) {
        showNotification('Please log in to create playlists', true);
        return;
      }
      const name = playlistNameInput.value.trim();
      const description = playlistDescriptionInput.value.trim();
      const isPublic = playlistPublicCheckbox.checked;
      if (!name) {
        showNotification('Please enter a playlist name', true);
        return;
      }
      try {
        await createPlaylist(getAppId(), currentUser.uid, { name, description, isPublic });
        showNotification(`Playlist "${name}" created!`, false);
        closePlaylistModal();
      } catch (error) {
        console.error('Error creating playlist:', error);
        showNotification('Failed to create playlist', true);
      }
    });
  }
}
