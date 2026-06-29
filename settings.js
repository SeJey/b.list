const defaultSettings = {
    theme: 'default',
    ratingSystem: '1-10',
    userProfiles: {},
    profile: {
        displayName: '',
        bio: '',
        avatarUrl: '',
        avatarDataUrl: '',
        avatarCleared: false
    },
    preferences: {
        compactCards: false,
        defaultAddStatus: 'planning'
    },
    privacy: {
        publicProfile: true,
        showEmailOnProfile: true,
        shareActivity: true,
        activityVisibility: 'public'
    },
    notifications: {
        recommendations: true,
        follows: true,
        releases: false
    }
};

let settings = { ...defaultSettings };

function mergeSettings(base, saved) {
    const merged = { ...base, ...(saved || {}) };
    merged.profile = { ...base.profile, ...(saved?.profile || {}) };
    merged.preferences = { ...base.preferences, ...(saved?.preferences || {}) };
    merged.privacy = { ...base.privacy, ...(saved?.privacy || {}) };
    merged.notifications = { ...base.notifications, ...(saved?.notifications || {}) };
    merged.userProfiles = { ...(saved?.userProfiles || {}) };

    if (saved?.defaultAddStatus && !saved?.preferences?.defaultAddStatus) {
        merged.preferences.defaultAddStatus = saved.defaultAddStatus;
    }
    if (saved?.privacy?.shareActivity === undefined) {
        merged.privacy.shareActivity = merged.privacy.activityVisibility !== 'private';
    }

    return merged;
}

function loadSettings() {
    try {
        const raw = localStorage.getItem('blist-settings');
        if (raw) {
            settings = mergeSettings(defaultSettings, JSON.parse(raw));
            delete settings.geminiKey;
            // Migrate old 'stars' rating system to '1-10'
            if (settings.ratingSystem === 'stars') {
                settings.ratingSystem = '1-10';
            }
            saveSettings();
        } else {
            settings = mergeSettings(defaultSettings, {});
        }
    } catch (e) {}
}

function saveSettings() {
    try { localStorage.setItem('blist-settings', JSON.stringify(settings)); } catch (e) {}
}

function applyTheme(t) {
    document.body.classList.remove('theme-light', 'theme-dark');
    if (t === 'light') document.body.classList.add('theme-light');
    if (t === 'dark') document.body.classList.add('theme-dark');
    document.body.classList.toggle('blist-compact', Boolean(settings.preferences?.compactCards));
}

export { settings, loadSettings, saveSettings, applyTheme };
