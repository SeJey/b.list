export function applyProfileUpdateToState(state = {}, profileData = {}) {
  const profile = state.currentUserProfile || {};
  const nextDisplayName = String(profileData.displayName || '').trim()
    || state.currentUser?.displayName
    || profile.displayName
    || 'Blist Member';

  const nextPhotoUrl = profileData.photoURL !== undefined
    ? String(profileData.photoURL || '')
    : (profile.photoURL || state.currentUser?.photoURL || '');
  const nextBio = profileData.bio !== undefined ? String(profileData.bio || '') : (profile.bio || '');
  const nextEmail = profileData.email !== undefined ? String(profileData.email || '') : (profile.email || state.currentUser?.email || '');
  const nextPublicProfile = profileData.publicProfile !== undefined ? Boolean(profileData.publicProfile) : (profile.publicProfile !== false);
  const nextShareActivity = profileData.shareActivity !== undefined ? Boolean(profileData.shareActivity) : (profile.shareActivity !== false);
  const nextActivityVisibility = profileData.activityVisibility || profile.activityVisibility || 'public';

  const nextProfile = {
    ...profile,
    uid: state.currentUser?.uid || profile.uid || profileData.uid || '',
    displayName: nextDisplayName,
    username: nextDisplayName,
    usernameLower: String(nextDisplayName || '').toLowerCase(),
    photoURL: nextPhotoUrl,
    bio: nextBio,
    email: nextEmail,
    publicProfile: nextPublicProfile,
    shareActivity: nextShareActivity,
    activityVisibility: nextActivityVisibility,
    initials: profile.initials || state.currentUser?.displayName || nextDisplayName
  };

  if (state.currentUser) {
    state.currentUser.displayName = nextDisplayName;
    state.currentUser.photoURL = nextPhotoUrl;
    state.currentUser.email = nextEmail;
  }

  state.currentUserProfile = nextProfile;
  return nextProfile;
}
