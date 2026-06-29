# Firestore activity rules

The website now reads and writes activity documents at:

`artifacts/{appId}/public/data/activity-events/{eventId}`

This repository does not contain the project's complete Firestore rules, so do **not** deploy this fragment as a replacement ruleset. Merge the following contract into the rules managed in Firebase Console (or the infrastructure repository):

```text
match /artifacts/{appId}/public/data/activity-events/{eventId} {
  allow read: if request.auth != null;

  allow create: if request.auth != null
    && request.resource.data.actorId == request.auth.uid
    && request.resource.data.id == eventId;

  allow update: if false;

  allow delete: if request.auth != null
    && resource.data.actorId == request.auth.uid;
}
```

The existing owner-write rule for `artifacts/{appId}/users/{userId}` must also allow the authenticated owner to write the boolean `shareActivity` field. Other users only need access to the already-public profile fields used by follow controls; private movie-list subcollections should remain private.

Activity publishing is deliberately non-blocking. If these rules are absent, tracking and ratings continue to work, but the UI reports that live community activity is unavailable.
