function getProfileName(profile = {}) {
  return profile.displayName || profile.username || (profile.email ? profile.email.split('@')[0] : 'Blist User');
}

function getProfileInitials(profile = {}) {
  if (profile.initials) return profile.initials;
  return getProfileName(profile)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

export function createUserSocialController({
  state,
  subscribeToUserFollows,
  subscribeToSuggestedUsers,
  upsertFollowedUser,
  removeFollowedUser,
  updateProfileStats,
  showNotification
}) {
  function notifySocialUsersChanged() {
    document.dispatchEvent(new CustomEvent('blist:socialUsersChanged'));
  }

  function isFollowingUser(userId) {
    return state.userFollows.has(String(userId));
  }

  function getFollowedUserIds() {
    return new Set(Array.from(state.userFollows.keys()).map(String));
  }

  function updateFollowUserButtonsState(root = document) {
    const canFollow = Boolean(state.currentUser);

    root.querySelectorAll('.follow-user-btn').forEach((btn) => {
      const userId = String(btn.dataset.userId || '');
      if (!userId) return;

      const isSelf = userId === String(state.currentUser?.uid || '');
      if (!canFollow || isSelf) {
        btn.disabled = true;
        btn.textContent = isSelf ? 'You' : 'Follow';
        btn.classList.toggle('hidden', isSelf);
        return;
      }

      const followed = isFollowingUser(userId);
      btn.disabled = false;
      btn.classList.remove('hidden');
      btn.textContent = followed ? 'Following' : 'Follow';
      btn.classList.toggle('bg-emerald-600', followed);
      btn.classList.toggle('hover:bg-emerald-500', followed);
      btn.classList.toggle('bg-sky-600', !followed);
      btn.classList.toggle('hover:bg-sky-500', !followed);
    });
  }

  function setupUserFollowsListener() {
    if (typeof state.userFollowsUnsubscribe === 'function') {
      state.userFollowsUnsubscribe();
      state.userFollowsUnsubscribe = null;
    }

    if (!state.currentUser) {
      state.userFollows = new Map();
      updateFollowUserButtonsState();
      updateProfileStats?.({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });
      notifySocialUsersChanged();
      return;
    }

    state.userFollowsUnsubscribe = subscribeToUserFollows(state.appId, state.currentUser.uid, (latestMap) => {
      state.userFollows = latestMap;
      updateFollowUserButtonsState();
      updateProfileStats?.({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });
      notifySocialUsersChanged();
    });
  }

  function setupSuggestedUsersListener() {
    if (typeof state.suggestedUsersUnsubscribe === 'function') {
      state.suggestedUsersUnsubscribe();
      state.suggestedUsersUnsubscribe = null;
    }

    state.suggestedUsersUnsubscribe = subscribeToSuggestedUsers(state.appId, state.currentUser?.uid || '', (users) => {
      state.suggestedUsers = users;
      notifySocialUsersChanged();
    });
  }

  async function toggleFollowUser(targetUserId, fallbackProfile = {}) {
    const userId = String(targetUserId || '');
    if (!userId || userId === String(state.currentUser?.uid || '')) return;

    if (!state.currentUser) {
      showNotification('Please log in to follow users.', false);
      return;
    }

    const profile = state.suggestedUsers.find(user => String(user.uid) === userId) || fallbackProfile;
    const name = getProfileName(profile);

    try {
      if (isFollowingUser(userId)) {
        state.userFollows.delete(userId);
        await removeFollowedUser(state.appId, state.currentUser.uid, userId);
        showNotification(`Unfollowed ${name}.`, false, 2500);
      } else {
        state.userFollows.set(userId, {
          uid: userId,
          displayName: name,
          username: profile.username || name,
          email: profile.email || '',
          photoURL: profile.photoURL || '',
          initials: profile.initials || getProfileInitials(profile)
        });
        await upsertFollowedUser(state.appId, state.currentUser.uid, userId, {
          ...profile,
          uid: userId,
          displayName: name
        });
        showNotification(`Following ${name}.`, false, 2500);
      }
    } catch (error) {
      console.error('toggleFollowUser failed:', error);
      showNotification('Could not update follow status.', true);
    }

    updateFollowUserButtonsState();
    notifySocialUsersChanged();
  }

  return {
    setupUserFollowsListener,
    setupSuggestedUsersListener,
    updateFollowUserButtonsState,
    toggleFollowUser,
    isFollowingUser,
    getFollowedUserIds
  };
}
