/**
 * Wires click handlers for activity tab button groups.
 */
export function setupActivityTabBindings({
  activityTabs,
  homeActivityTabs,
  setActivityTab,
  setHomeActivityTab
}) {
  if (activityTabs.activity) {
    activityTabs.activity.addEventListener('click', () => {
      setActivityTab('activity');
    });
  }

  if (activityTabs.following) {
    activityTabs.following.addEventListener('click', () => {
      setActivityTab('following');
    });
  }

  if (activityTabs.global) {
    activityTabs.global.addEventListener('click', () => {
      setActivityTab('global');
    });
  }

  if (homeActivityTabs.activity) {
    homeActivityTabs.activity.addEventListener('click', () => {
      setHomeActivityTab('activity');
    });
  }

  if (homeActivityTabs.following) {
    homeActivityTabs.following.addEventListener('click', () => {
      setHomeActivityTab('following');
    });
  }

  if (homeActivityTabs.global) {
    homeActivityTabs.global.addEventListener('click', () => {
      setHomeActivityTab('global');
    });
  }
}
