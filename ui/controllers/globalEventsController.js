export function setupGlobalEventListeners({ toggleFollowPerson, toggleFollowUser }) {
  document.addEventListener('click', (event) => {
    const followPersonBtn = event.target.closest('.follow-person-btn');
    if (followPersonBtn) {
      event.preventDefault();
      event.stopPropagation();
      const personId = String(followPersonBtn.dataset.personId || '');
      if (personId) {
        void toggleFollowPerson(
          String(followPersonBtn.dataset.personType || 'actor'),
          personId,
          String(followPersonBtn.dataset.personName || ''),
          String(followPersonBtn.dataset.profilePath || '')
        );
      }
      return;
    }

    const followUserBtn = event.target.closest('.follow-user-btn');
    if (followUserBtn) {
      event.preventDefault();
      event.stopPropagation();
      const userId = String(followUserBtn.dataset.userId || '');
      if (userId) {
        void toggleFollowUser(userId, {
          uid: userId,
          displayName: String(followUserBtn.dataset.userName || ''),
          email: String(followUserBtn.dataset.userEmail || ''),
          photoURL: String(followUserBtn.dataset.userPhoto || ''),
          initials: String(followUserBtn.dataset.userInitials || '')
        });
      }
      return;
    }

    const profileMediaCard = event.target.closest('.profile-media-card, .profile-activity-item, .profile-genre-item');
    if (profileMediaCard?.dataset.movieId) {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('openMoviePage', {
        detail: {
          movieId: profileMediaCard.dataset.movieId,
          backPage: profileMediaCard.closest('#home-page') ? 'home' : 'user-profile'
        }
      }));
      return;
    }

    const progressItem = event.target.closest('.home-progress-item');
    if (progressItem?.dataset.movieId) {
      document.dispatchEvent(new CustomEvent('movieCardClick', {
        detail: { movieId: progressItem.dataset.movieId }
      }));
    }
  });
}
