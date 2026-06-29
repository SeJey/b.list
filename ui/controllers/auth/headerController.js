import { escapeAttribute } from '../../../utils/helpers.js';

function renderAvatar(container, initials, photoUrl, imageClass) {
  if (!container) return;
  container.innerHTML = photoUrl
    ? `<img src="${escapeAttribute(photoUrl)}" alt="" class="${imageClass} object-cover">`
    : `<span>${escapeAttribute(initials)}</span>`;
}

export function renderAuthUI({
  state,
  elements,
  switchPage,
  getUserInitials,
  updateProfileStats,
  updateProfileLists
}) {
  const { container, profileMenuContainer } = elements.auth;

  if (!state.currentUser) {
    profileMenuContainer?.classList.add('hidden');
    if (container) {
      container.innerHTML = '<button type="button" id="auth-header-btn" class="btn btn-primary header-login-btn">Sign in</button>';
    }
    document.getElementById('auth-header-btn')?.addEventListener('click', () => switchPage('auth'));
  } else {
    profileMenuContainer?.classList.remove('hidden');
    const profile = state.currentUserProfile || {};
    const username = profile.username || profile.displayName || state.currentUser.displayName || 'Blist Member';
    const initials = profile.initials || getUserInitials({ displayName: username });
    const photoUrl = profile.photoURL || '';

    renderAvatar(elements.auth.profileIconBtn, initials, photoUrl, 'h-full w-full rounded-full');
    renderAvatar(elements.auth.profileAvatarLarge, initials, photoUrl, 'h-full w-full rounded-md');

    if (elements.auth.profileUserName) elements.auth.profileUserName.textContent = username;
    if (elements.auth.profileUserEmail) {
      elements.auth.profileUserEmail.textContent = profile.email || '';
      elements.auth.profileUserEmail.classList.toggle('hidden', !profile.email);
    }
    if (elements.auth.profileBio) {
      elements.auth.profileBio.textContent = profile.bio || 'Build your Blist, track your progress, and keep discovering what is next.';
    }

    updateProfileStats({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });
    updateProfileLists({ userMovieList: state.userMovieList });
    if (container) container.innerHTML = '';
  }

  elements.nav.myList?.classList.toggle('hidden', !state.currentUser);
}
