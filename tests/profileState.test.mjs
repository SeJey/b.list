import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProfileUpdateToState } from '../utils/profileState.mjs';

test('applyProfileUpdateToState updates the active user and profile display name', () => {
  const state = {
    currentUser: {
      uid: 'user-1',
      displayName: 'Blist Member',
      photoURL: '',
      email: ''
    },
    currentUserProfile: {
      displayName: 'Blist Member',
      username: 'Blist Member',
      photoURL: '',
      bio: ''
    }
  };

  const updatedProfile = applyProfileUpdateToState(state, {
    displayName: 'Ada Lovelace',
    photoURL: 'https://example.com/avatar.png',
    bio: 'Reading and building.',
    email: 'ada@example.com',
    publicProfile: true,
    shareActivity: true,
    activityVisibility: 'public'
  });

  assert.equal(state.currentUser.displayName, 'Ada Lovelace');
  assert.equal(state.currentUserProfile.displayName, 'Ada Lovelace');
  assert.equal(state.currentUserProfile.username, 'Ada Lovelace');
  assert.equal(state.currentUserProfile.usernameLower, 'ada lovelace');
  assert.equal(updatedProfile.displayName, 'Ada Lovelace');
});
