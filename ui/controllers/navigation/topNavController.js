/**
 * Wires top navigation and browse dropdown interactions.
 */
export function setupTopNavAndBrowseHandlers({
  elements,
  onHomeClick,
  onMyListClick,
  onForumClick,
  onBrowseMoviesClick,
  onBrowseSeriesClick,
  onBrowseActorsClick,
  onBrowseDirectorsClick
}) {
  const {
    navHome,
    navMyList,
    navForum,
    browseDropdown,
    browseMenuMovies,
    browseMenuSeries,
    browseMenuActors,
    browseMenuDirectors
  } = elements;

  if (navHome) {
    navHome.addEventListener('click', (e) => {
      e.preventDefault();
      onHomeClick?.();
    });
  }

  if (navMyList) {
    navMyList.addEventListener('click', (e) => {
      e.preventDefault();
      onMyListClick?.();
    });
  }

  if (navForum) {
    navForum.addEventListener('click', (e) => {
      e.preventDefault();
      onForumClick?.();
    });
  }

  document.getElementById('logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    onHomeClick?.();
  });

  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const primaryNavigation = document.getElementById('primary-navigation');
  const closeMobileMenu = () => {
    primaryNavigation?.classList.remove('is-open');
    mobileMenuBtn?.setAttribute('aria-expanded', 'false');
    mobileMenuBtn?.setAttribute('aria-label', 'Open navigation');
  };

  mobileMenuBtn?.addEventListener('click', () => {
    const willOpen = !primaryNavigation?.classList.contains('is-open');
    primaryNavigation?.classList.toggle('is-open', willOpen);
    mobileMenuBtn.setAttribute('aria-expanded', String(willOpen));
    mobileMenuBtn.setAttribute('aria-label', willOpen ? 'Close navigation' : 'Open navigation');
  });

  primaryNavigation?.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMobileMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileMenu();
  });

  document.addEventListener('click', (event) => {
    if (!primaryNavigation?.classList.contains('is-open')) return;
    if (!primaryNavigation.contains(event.target) && !mobileMenuBtn?.contains(event.target)) closeMobileMenu();
  });

  const browseDropdownContainer = document.querySelector('.browse-dropdown-container');
  if (browseDropdownContainer && browseDropdown) {
    let closeDropdownTimeout;

    const openDropdown = () => {
      clearTimeout(closeDropdownTimeout);
      browseDropdown.classList.remove('hidden');
    };

    const closeDropdown = () => {
      closeDropdownTimeout = setTimeout(() => {
        browseDropdown.classList.add('hidden');
      }, 150);
    };

    browseDropdownContainer.addEventListener('mouseenter', openDropdown);
    browseDropdownContainer.addEventListener('mouseleave', closeDropdown);
    browseDropdown.addEventListener('mouseenter', openDropdown);
    browseDropdown.addEventListener('mouseleave', closeDropdown);
  }

  const hideBrowseDropdown = () => browseDropdown?.classList.add('hidden');

  if (browseMenuMovies) {
    browseMenuMovies.addEventListener('click', (e) => {
      e.preventDefault();
      hideBrowseDropdown();
      onBrowseMoviesClick?.();
    });
  }

  if (browseMenuSeries) {
    browseMenuSeries.addEventListener('click', (e) => {
      e.preventDefault();
      hideBrowseDropdown();
      onBrowseSeriesClick?.();
    });
  }

  if (browseMenuActors) {
    browseMenuActors.addEventListener('click', (e) => {
      e.preventDefault();
      hideBrowseDropdown();
      onBrowseActorsClick?.();
    });
  }

  if (browseMenuDirectors) {
    browseMenuDirectors.addEventListener('click', (e) => {
      e.preventDefault();
      hideBrowseDropdown();
      onBrowseDirectorsClick?.();
    });
  }
}
