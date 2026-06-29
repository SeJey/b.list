import { updateProfile } from '../../../firebase.js';
import { handleForgotPassword } from '../../../auth.js';
import { escapeAttribute, normalizeRatingForStorage } from '../../../utils/helpers.js';
import { applyProfileUpdateToState } from '../../../utils/profileState.mjs';

function getSavedProfile(settings = {}, user = {}) {
  const userProfile = user?.uid ? settings.userProfiles?.[user.uid] : null;
  return { ...(settings.profile || {}), ...(userProfile || {}) };
}

function saveSavedProfile(settings = {}, user = {}, profile = {}) {
  if (user?.uid) {
    settings.userProfiles = settings.userProfiles || {};
    settings.userProfiles[user.uid] = {
      ...(settings.userProfiles[user.uid] || {}),
      ...profile,
      updatedAt: new Date().toISOString()
    };
    return;
  }

  settings.profile = { ...(settings.profile || {}), ...profile };
}

function getInitials(nameOrEmail = 'U') {
  return String(nameOrEmail || 'U')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

function renderAvatarPreview(container, initialsContainer, initials, imageUrl) {
  if (!container) return;
  if (imageUrl) {
    container.innerHTML = `<img src="${escapeAttribute(imageUrl)}" alt="" class="w-full h-full object-cover">`;
    return;
  }

  container.innerHTML = `<span id="settings-avatar-initials">${escapeAttribute(initials)}</span>`;
  const nextInitialsContainer = initialsContainer || container.querySelector('#settings-avatar-initials');
  if (nextInitialsContainer) nextInitialsContainer.textContent = initials;
}

function ensureSettingsBranches(settings = {}) {
  settings.preferences = settings.preferences || {};
  settings.privacy = settings.privacy || {};
  settings.notifications = settings.notifications || {};
  settings.userProfiles = settings.userProfiles || {};
}

function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not load that image.'));
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        canvas.width = size;
        canvas.height = size;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function parseCsv(text = '') {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some(cell => cell !== '')) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map(header => String(header || '').trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = cells[index] || '';
    });
    return record;
  });
}

function normalizeImportStatus(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const statusMap = {
    complete: 'watched',
    completed: 'watched',
    watched: 'watched',
    watching: 'watching',
    current: 'watching',
    planned: 'planning',
    plan: 'planning',
    planning: 'planning',
    watchlist: 'planning',
    dropped: 'dropped'
  };
  return statusMap[normalized] || 'planning';
}

function getImportType(row = {}) {
  const rawType = String(row.type || row.media_type || row.kind || '').trim().toLowerCase();
  if (['series', 'tv', 'show', 'tv series'].includes(rawType)) return 'series';
  return 'movie';
}

export function setupSettingsControls({
  state,
  elements,
  settings,
  applyTheme,
  saveSettings,
  updateProfileStats,
  filterMyList,
  renderHeaderAuth,
  upsertPublicUserProfile,
  showNotification,
  updateMovieStatus,
  fetchTMDb,
  loadMyListPage,
  updateActivitySharingPreference,
  deleteUserActivityEvents
}) {
  const themeSelect = document.getElementById('theme-select');
  const ratingSystemSelect = document.getElementById('rating-system-select');
  const displayNameInput = document.getElementById('settings-display-name');
  const bioInput = document.getElementById('settings-bio');
  const avatarFileInput = document.getElementById('settings-avatar-file');
  const avatarUrlInput = document.getElementById('settings-avatar-url');
  const avatarPreview = document.getElementById('settings-avatar-preview');
  const avatarInitials = document.getElementById('settings-avatar-initials');
  const saveProfileBtn = document.getElementById('settings-save-profile-btn');
  const clearAvatarBtn = document.getElementById('settings-clear-avatar-btn');
  const compactCardsToggle = document.getElementById('compact-cards-toggle');
  const defaultAddStatusSelect = document.getElementById('default-add-status-select');
  const publicProfileToggle = document.getElementById('public-profile-toggle');
  const showEmailToggle = document.getElementById('show-email-toggle');
  const activityVisibilitySelect = document.getElementById('activity-visibility-select');
  const shareActivityToggle = document.getElementById('share-activity-toggle');
  const notifyRecommendationsToggle = document.getElementById('notify-recommendations-toggle');
  const notifyFollowsToggle = document.getElementById('notify-follows-toggle');
  const notifyReleasesToggle = document.getElementById('notify-releases-toggle');
  const exportSettingsBtn = document.getElementById('export-settings-btn');
  const resetSettingsBtn = document.getElementById('reset-settings-btn');
  const changePasswordBtn = document.getElementById('settings-change-password-btn');
  const importCsvFileInput = document.getElementById('settings-import-csv-file');
  const importCsvBtn = document.getElementById('settings-import-csv-btn');
  const importCsvSummary = document.getElementById('settings-import-csv-summary');
  const settingsNavButtons = Array.from(document.querySelectorAll('.settings-nav-btn'));
  const settingsPanels = Array.from(document.querySelectorAll('.settings-panel'));

  let pendingAvatarDataUrl = null;
  let avatarWasCleared = false;
  let pendingCsvRows = [];

  ensureSettingsBranches(settings);

  function showSettingsTab(tabName = 'account') {
    const nextTab = tabName || 'account';
    settingsNavButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.settingsTab === nextTab);
    });
    settingsPanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.settingsPanel !== nextTab);
    });
  }

  settingsNavButtons.forEach((button) => {
    button.addEventListener('click', () => showSettingsTab(button.dataset.settingsTab || 'account'));
  });

  document.addEventListener('blist:openSettingsTab', (event) => {
    showSettingsTab(event.detail?.tab || 'account');
  });

  function refreshSettingsForm() {
    ensureSettingsBranches(settings);
    const currentUser = state.currentUser;
    const savedProfile = getSavedProfile(settings, currentUser);
    const displayName = savedProfile.displayName || currentUser?.displayName || '';
    const avatarUrl = savedProfile.avatarUrl || '';
    const previewUrl = savedProfile.avatarCleared ? '' : (savedProfile.avatarDataUrl || avatarUrl || currentUser?.photoURL || '');
    const initials = getInitials(displayName || currentUser?.email || 'U');

    if (displayNameInput) displayNameInput.value = displayName;
    if (bioInput) bioInput.value = savedProfile.bio || '';
    if (avatarUrlInput) avatarUrlInput.value = avatarUrl;
    if (avatarFileInput) avatarFileInput.value = '';
    pendingAvatarDataUrl = null;
    avatarWasCleared = false;
    renderAvatarPreview(avatarPreview, avatarInitials, initials, previewUrl);

    if (themeSelect) themeSelect.value = settings.theme || 'default';
    if (ratingSystemSelect) ratingSystemSelect.value = settings.ratingSystem || '1-10';
    if (compactCardsToggle) compactCardsToggle.checked = Boolean(settings.preferences.compactCards);
    if (defaultAddStatusSelect) defaultAddStatusSelect.value = settings.preferences.defaultAddStatus || 'planning';
    if (publicProfileToggle) publicProfileToggle.checked = settings.privacy.publicProfile !== false;
    if (showEmailToggle) showEmailToggle.checked = settings.privacy.showEmailOnProfile !== false;
    if (activityVisibilitySelect) activityVisibilitySelect.value = settings.privacy.activityVisibility || 'public';
    syncActivitySharingToggle();
    if (notifyRecommendationsToggle) notifyRecommendationsToggle.checked = settings.notifications.recommendations !== false;
    if (notifyFollowsToggle) notifyFollowsToggle.checked = settings.notifications.follows !== false;
    if (notifyReleasesToggle) notifyReleasesToggle.checked = Boolean(settings.notifications.releases);
  }

  function saveAndRender() {
    saveSettings();
    applyTheme(settings.theme);
    renderHeaderAuth?.();
  }

  function syncActivitySharingToggle() {
    const enabled = state.currentUserProfile?.shareActivity ?? settings.privacy.shareActivity ?? (settings.privacy.activityVisibility !== 'private');
    if (shareActivityToggle) {
      shareActivityToggle.checked = Boolean(enabled);
      shareActivityToggle.disabled = !state.currentUser;
    }
    if (activityVisibilitySelect) activityVisibilitySelect.disabled = !enabled || !state.currentUser;
  }

  async function syncPublicProfile() {
    if (!state.currentUser || !upsertPublicUserProfile) return;
    const savedProfile = getSavedProfile(settings, state.currentUser);
    const profile = await upsertPublicUserProfile(state.appId, {
      ...state.currentUser,
      displayName: savedProfile.displayName || state.currentUser.displayName,
      photoURL: savedProfile.avatarCleared ? '' : (savedProfile.avatarDataUrl || savedProfile.avatarUrl || state.currentUser.photoURL),
      email: settings.privacy.showEmailOnProfile === false ? '' : state.currentUser.email,
      bio: savedProfile.bio || '',
      publicProfile: settings.privacy.publicProfile !== false,
      activityVisibility: settings.privacy.activityVisibility || 'public',
      shareActivity: settings.privacy.shareActivity !== false
    });
    if (profile) applyProfileUpdateToState(state, profile);
    renderHeaderAuth?.();
  }

  async function resolveImportMedia(row = {}) {
    const type = getImportType(row);
    const idValue = row.tmdb_id || row.tmdb || row.id || '';

    if (idValue) {
      const dbId = type === 'series' ? `tmdb_tv_${idValue}` : `tmdb_${idValue}`;
      try {
        const endpoint = type === 'series' ? `/tv/${encodeURIComponent(idValue)}` : `/movie/${encodeURIComponent(idValue)}`;
        const details = await fetchTMDb?.(endpoint, 'language=en-US');
        if (details?.id) {
          return { dbId, media: details, type };
        }
      } catch (error) {
        console.warn('CSV import could not resolve TMDb id:', idValue, error);
      }
      return {
        dbId,
        media: {
          id: idValue,
          title: row.title || row.name || 'Imported title',
          name: row.title || row.name || 'Imported title',
          poster_path: row.poster_path || ''
        },
        type
      };
    }

    const title = row.title || row.name;
    if (!title) return null;

    const endpoint = type === 'series' ? '/search/tv' : '/search/movie';
    const data = await fetchTMDb?.(endpoint, `query=${encodeURIComponent(title)}&language=en-US`);
    const match = data?.results?.[0];
    if (!match?.id) return null;

    return {
      dbId: type === 'series' ? `tmdb_tv_${match.id}` : `tmdb_${match.id}`,
      media: match,
      type
    };
  }

  function setCsvSummary(message = '', isError = false) {
    if (!importCsvSummary) return;
    importCsvSummary.textContent = message;
    importCsvSummary.classList.remove('hidden');
    importCsvSummary.classList.toggle('text-red-300', isError);
    importCsvSummary.classList.toggle('text-gray-300', !isError);
  }

  if (themeSelect) {
    themeSelect.value = settings.theme || 'default';
    themeSelect.addEventListener('change', (event) => {
      settings.theme = event.target.value;
      saveAndRender();
    });
  }

  if (ratingSystemSelect) {
    ratingSystemSelect.value = settings.ratingSystem || '1-10';
    ratingSystemSelect.addEventListener('change', (event) => {
      settings.ratingSystem = event.target.value;
      saveSettings();
      updateProfileStats({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows, appId: state.appId, currentUserId: state.currentUser?.uid || '' });

      if (state.currentPage === 'my-list') {
        const activeFilter = document.querySelector('#my-list-filters .filter-btn.active')?.dataset.status || 'all';
        filterMyList(
          activeFilter,
          state.myListPageMovies,
          state.userMovieList,
          elements.myList.grid,
          elements.myList.sortRatingBtn?.dataset.sortMode || 'added'
        );
      }
    });
  }

  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showNotification?.('Please choose an image file.', true);
        return;
      }

      try {
        pendingAvatarDataUrl = await readImageFileAsDataUrl(file);
        avatarWasCleared = false;
        if (avatarUrlInput) avatarUrlInput.value = '';
        const initials = getInitials(displayNameInput?.value || state.currentUser?.email || 'U');
        renderAvatarPreview(avatarPreview, avatarInitials, initials, pendingAvatarDataUrl);
      } catch (error) {
        console.error('Profile image load failed:', error);
        showNotification?.(error.message || 'Could not load that image.', true);
      }
    });
  }

  if (avatarUrlInput) {
    avatarUrlInput.addEventListener('input', () => {
      pendingAvatarDataUrl = null;
      avatarWasCleared = false;
      const initials = getInitials(displayNameInput?.value || state.currentUser?.email || 'U');
      renderAvatarPreview(avatarPreview, avatarInitials, initials, avatarUrlInput.value.trim());
    });
  }

  if (displayNameInput) {
    displayNameInput.addEventListener('input', () => {
      const savedProfile = getSavedProfile(settings, state.currentUser);
      const previewImage = pendingAvatarDataUrl || avatarUrlInput?.value.trim() || savedProfile.avatarDataUrl || (savedProfile.avatarCleared ? '' : state.currentUser?.photoURL) || '';
      renderAvatarPreview(avatarPreview, avatarInitials, getInitials(displayNameInput.value || state.currentUser?.email || 'U'), previewImage);
    });
  }

  if (clearAvatarBtn) {
    clearAvatarBtn.addEventListener('click', () => {
      pendingAvatarDataUrl = null;
      avatarWasCleared = true;
      if (avatarFileInput) avatarFileInput.value = '';
      if (avatarUrlInput) avatarUrlInput.value = '';
      renderAvatarPreview(avatarPreview, avatarInitials, getInitials(displayNameInput?.value || state.currentUser?.email || 'U'), '');
    });
  }

  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      if (!state.currentUser) {
        showNotification?.('Please log in to edit your profile.', true);
        return;
      }

      const currentProfile = getSavedProfile(settings, state.currentUser);
      const displayName = String(displayNameInput?.value || '').trim() || state.currentUser.displayName || 'User';
      const bio = String(bioInput?.value || '').trim();
      const avatarUrl = avatarWasCleared ? '' : String(avatarUrlInput?.value || '').trim();
      const avatarDataUrl = avatarWasCleared || avatarUrl ? '' : (pendingAvatarDataUrl || currentProfile.avatarDataUrl || '');
      const fallbackPhotoURL = avatarWasCleared || currentProfile.avatarCleared ? '' : (state.currentUser.photoURL || '');
      const photoURL = avatarDataUrl || avatarUrl || fallbackPhotoURL;

      saveSavedProfile(settings, state.currentUser, {
        displayName,
        bio,
        avatarUrl,
        avatarDataUrl,
        avatarCleared: avatarWasCleared || (!photoURL && currentProfile.avatarCleared)
      });

      applyProfileUpdateToState(state, {
        displayName,
        photoURL,
        bio,
        email: settings.privacy.showEmailOnProfile === false ? '' : state.currentUser.email,
        publicProfile: settings.privacy.publicProfile !== false,
        activityVisibility: settings.privacy.activityVisibility || 'public',
        shareActivity: settings.privacy.shareActivity !== false
      });
      saveAndRender();

      try {
        const authPhotoURL = avatarDataUrl ? (state.currentUser.photoURL || '') : photoURL;
        await updateProfile(state.currentUser, {
          displayName,
          photoURL: authPhotoURL
        });
      } catch (error) {
        console.warn('Firebase auth profile update failed; saved locally instead:', error);
      }

      try {
        const profile = await upsertPublicUserProfile?.(state.appId, {
          ...state.currentUser,
          displayName,
          photoURL,
          email: settings.privacy.showEmailOnProfile === false ? '' : state.currentUser.email,
          bio,
          publicProfile: settings.privacy.publicProfile !== false,
          activityVisibility: settings.privacy.activityVisibility || 'public',
          shareActivity: settings.privacy.shareActivity !== false
        });
        if (profile) {
          applyProfileUpdateToState(state, profile);
        }
      } catch (error) {
        console.warn('Public profile update failed:', error);
      }

      pendingAvatarDataUrl = null;
      avatarWasCleared = false;
      renderHeaderAuth?.();
      showNotification?.('Profile settings saved.', false);
    });
  }

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', async () => {
      const email = state.currentUser?.email || '';
      if (!email) {
        showNotification?.('No email address is available for this account.', true);
        return;
      }

      try {
        await handleForgotPassword(email);
        showNotification?.(`Password reset email sent to ${email}.`, false);
      } catch (error) {
        console.error('Change password failed:', error);
        showNotification?.(error.message || 'Could not send password reset email.', true);
      }
    });
  }

  if (importCsvFileInput) {
    importCsvFileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      pendingCsvRows = [];
      if (importCsvBtn) importCsvBtn.disabled = true;
      if (!file) {
        importCsvSummary?.classList.add('hidden');
        return;
      }

      try {
        const text = await file.text();
        pendingCsvRows = parseCsv(text);
        if (pendingCsvRows.length === 0) {
          setCsvSummary('No importable rows were found. Make sure the first row contains column names.', true);
          return;
        }
        if (importCsvBtn) importCsvBtn.disabled = false;
        setCsvSummary(`${pendingCsvRows.length} row${pendingCsvRows.length === 1 ? '' : 's'} ready to import.`);
      } catch (error) {
        console.error('CSV import read failed:', error);
        setCsvSummary('Could not read that CSV file.', true);
      }
    });
  }

  if (importCsvBtn) {
    importCsvBtn.addEventListener('click', async () => {
      if (!state.currentUser) {
        showNotification?.('Please log in to import a list.', true);
        return;
      }
      if (!pendingCsvRows.length) {
        setCsvSummary('Choose a CSV file first.', true);
        return;
      }

      importCsvBtn.disabled = true;
      setCsvSummary(`Importing ${pendingCsvRows.length} row${pendingCsvRows.length === 1 ? '' : 's'}...`);

      let imported = 0;
      let skipped = 0;

      for (const row of pendingCsvRows) {
        try {
          const resolved = await resolveImportMedia(row);
          if (!resolved?.dbId) {
            skipped += 1;
            continue;
          }

          const title = resolved.media.title || resolved.media.name || row.title || row.name || 'Imported title';
          const posterPath = resolved.media.poster_path || row.poster_path || '';
          const rating = row.rating || row.score
            ? normalizeRatingForStorage(row.rating || row.score, settings.ratingSystem)
            : undefined;
          const entry = {
            ...(state.userMovieList.get(resolved.dbId) || {}),
            title,
            poster_path: posterPath,
            status: normalizeImportStatus(row.status),
            type: resolved.type,
            media_type: resolved.type === 'series' ? 'tv' : 'movie',
            addedAt: new Date()
          };
          if (rating) entry.rating = rating;
          if (resolved.media.runtime) entry.runtime = resolved.media.runtime;
          if (resolved.media.episode_run_time?.[0]) entry.runtime = resolved.media.episode_run_time[0];

          await updateMovieStatus?.(state.appId, state.currentUser.uid, resolved.dbId, entry);
          imported += 1;
        } catch (error) {
          console.warn('CSV row import failed:', row, error);
          skipped += 1;
        }
      }

      setCsvSummary(`Imported ${imported} title${imported === 1 ? '' : 's'}. ${skipped ? `${skipped} row${skipped === 1 ? '' : 's'} skipped.` : ''}`);
      showNotification?.(`Imported ${imported} title${imported === 1 ? '' : 's'}.`, false);

      if (state.currentPage === 'my-list') {
        await loadMyListPage?.(
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

      importCsvBtn.disabled = false;
    });
  }

  if (compactCardsToggle) {
    compactCardsToggle.addEventListener('change', (event) => {
      settings.preferences.compactCards = event.target.checked;
      saveAndRender();
    });
  }

  if (defaultAddStatusSelect) {
    defaultAddStatusSelect.addEventListener('change', (event) => {
      settings.preferences.defaultAddStatus = event.target.value;
      saveSettings();
    });
  }

  if (publicProfileToggle) {
    publicProfileToggle.addEventListener('change', (event) => {
      settings.privacy.publicProfile = event.target.checked;
      saveAndRender();
      void syncPublicProfile().catch(error => console.warn('Public profile sync failed:', error));
    });
  }

  if (showEmailToggle) {
    showEmailToggle.addEventListener('change', (event) => {
      settings.privacy.showEmailOnProfile = event.target.checked;
      saveAndRender();
      void syncPublicProfile().catch(error => console.warn('Public profile sync failed:', error));
    });
  }

  if (activityVisibilitySelect) {
    activityVisibilitySelect.addEventListener('change', async (event) => {
      const previousVisibility = settings.privacy.activityVisibility || 'public';
      settings.privacy.activityVisibility = event.target.value;
      settings.privacy.shareActivity = event.target.value !== 'private';
      saveSettings();
      if (state.currentUser && updateActivitySharingPreference) {
        try {
          if (previousVisibility === 'public' && event.target.value === 'followers') {
            await deleteUserActivityEvents?.(state.appId, state.currentUser.uid);
          }
          await updateActivitySharingPreference(state.appId, state.currentUser.uid, settings.privacy.shareActivity);
          state.currentUserProfile = { ...(state.currentUserProfile || {}), shareActivity: settings.privacy.shareActivity, activityVisibility: event.target.value };
        } catch (error) {
          console.error('Activity visibility update failed:', error);
          showNotification?.('Could not update activity visibility.', true);
        }
      }
      void syncPublicProfile();
      syncActivitySharingToggle();
    });
  }

  if (shareActivityToggle) {
    shareActivityToggle.addEventListener('change', async (event) => {
      if (!state.currentUser) {
        syncActivitySharingToggle();
        showNotification?.('Please log in to change activity sharing.', true);
        return;
      }
      const enabled = Boolean(event.target.checked);
      settings.privacy.shareActivity = enabled;
      if (!enabled) settings.privacy.activityVisibility = 'private';
      if (enabled && settings.privacy.activityVisibility === 'private') settings.privacy.activityVisibility = 'public';
      saveSettings();
      try {
        await updateActivitySharingPreference?.(state.appId, state.currentUser.uid, enabled);
        state.currentUserProfile = { ...(state.currentUserProfile || {}), shareActivity: enabled, activityVisibility: settings.privacy.activityVisibility };
        await syncPublicProfile();
        showNotification?.(enabled ? 'Activity sharing enabled.' : 'Shared activity removed.', false);
      } catch (error) {
        settings.privacy.shareActivity = !enabled;
        saveSettings();
        showNotification?.('Could not update activity sharing.', true);
      }
      refreshSettingsForm();
    });
  }

  if (notifyRecommendationsToggle) {
    notifyRecommendationsToggle.addEventListener('change', (event) => {
      settings.notifications.recommendations = event.target.checked;
      saveSettings();
    });
  }

  if (notifyFollowsToggle) {
    notifyFollowsToggle.addEventListener('change', (event) => {
      settings.notifications.follows = event.target.checked;
      saveSettings();
    });
  }

  if (notifyReleasesToggle) {
    notifyReleasesToggle.addEventListener('change', (event) => {
      settings.notifications.releases = event.target.checked;
      saveSettings();
    });
  }

  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener('click', async () => {
      const exported = JSON.stringify(settings, null, 2);
      try {
        await navigator.clipboard.writeText(exported);
        showNotification?.('Settings copied to clipboard.', false);
      } catch (error) {
        console.info('Settings export:', exported);
        showNotification?.('Settings printed to the console.', false);
      }
    });
  }

  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
      const currentProfile = getSavedProfile(settings, state.currentUser);
      settings.theme = 'default';
      settings.ratingSystem = '1-10';
      settings.preferences = { compactCards: false, defaultAddStatus: 'planning' };
      settings.privacy = { publicProfile: true, showEmailOnProfile: true, shareActivity: true, activityVisibility: 'public' };
      settings.notifications = { recommendations: true, follows: true, releases: false };
      saveSavedProfile(settings, state.currentUser, currentProfile);
      saveAndRender();
      void syncPublicProfile().catch(error => console.warn('Public profile sync failed:', error));
      refreshSettingsForm();
      showNotification?.('Settings reset.', false);
    });
  }

  showSettingsTab('account');
  refreshSettingsForm();

  return { refreshSettingsForm, showSettingsTab, syncActivitySharingToggle };
}
