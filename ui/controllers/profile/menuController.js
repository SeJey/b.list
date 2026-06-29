import { handleLogout } from '../../../auth.js';
import { showNotification } from '../../ui.js';

/**
 * Wires profile dropdown and menu item handlers.
 */
export function setupProfileMenuHandlers({ switchPage, onProfileOpen, onLogoutSuccess }) {
  const profileIconBtn = document.getElementById('profile-icon-btn');
  const profileDropdown = document.getElementById('profile-dropdown');
  const profileMenuContainer = document.getElementById('profile-menu-container');

  const closeDropdown = () => {
    profileDropdown?.classList.add('hidden');
    profileIconBtn?.setAttribute('aria-expanded', 'false');
  };

  if (profileIconBtn) {
    profileIconBtn.addEventListener('click', () => {
      if (profileDropdown) {
        profileDropdown.classList.toggle('hidden');
        profileIconBtn.setAttribute('aria-expanded', profileDropdown.classList.contains('hidden') ? 'false' : 'true');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (profileMenuContainer && !profileMenuContainer.contains(e.target)) {
      closeDropdown();
    }
  });

  const profileMenuProfile = document.getElementById('profile-menu-profile');
  const profileMenuPlaylists = document.getElementById('profile-menu-playlists');
  const profileMenuSettings = document.getElementById('profile-menu-settings');
  const profileMenuNotifications = document.getElementById('profile-menu-notifications');
  const profileMenuLogout = document.getElementById('profile-menu-logout');

  if (profileMenuProfile) {
    profileMenuProfile.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage('user-profile');
      onProfileOpen?.();
      closeDropdown();
    });
  }

  if (profileMenuPlaylists) {
    profileMenuPlaylists.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage('playlists');
      closeDropdown();
    });
  }

  if (profileMenuSettings) {
    profileMenuSettings.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage('settings');
      closeDropdown();
    });
  }

  if (profileMenuNotifications) {
    profileMenuNotifications.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage('notifications');
      closeDropdown();
    });
  }

  if (profileMenuLogout) {
    profileMenuLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await handleLogout();
        onLogoutSuccess?.();
        switchPage('home');
        closeDropdown();
      } catch (error) {
        console.error('Failed to logout:', error);
        showNotification('Logout failed. Please try again.', 'error');
      }
    });
  }
}
