export function createActivitySubscriptions({ state, subscribeToActivityEvents, onActivityChanged }) {
  function stop() {
    if (typeof state.activityUnsubscribe === 'function') state.activityUnsubscribe();
    state.activityUnsubscribe = null;
  }

  function start() {
    stop();
    state.activityEvents = [];
    state.activityRemoteAvailable = true;
    if (!state.currentUser) {
      onActivityChanged?.();
      return;
    }

    state.activityUnsubscribe = subscribeToActivityEvents(state.appId, (events, status = {}) => {
      state.activityEvents = events;
      state.activityRemoteAvailable = status.remoteAvailable !== false;
      onActivityChanged?.();
    });
  }

  return { start, stop };
}
