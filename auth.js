import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile, deleteUser } from './firebase.js';
import { db, doc, setDoc, collection, getDocs, query, runTransaction, where } from './firebase.js';

let currentUser = null;

function getAppId() {
    return (typeof __app_id !== 'undefined' && __app_id)
        ? __app_id
        : 'blist-default-app';
}

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function validateUsername(username) {
    const trimmed = String(username || '').trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
        throw new Error('Username must be between 3 and 30 characters.');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
        throw new Error('Username can only use letters, numbers, periods, underscores, and hyphens.');
    }
    return trimmed;
}

async function findExistingUsernameOwner(appId, normalizedUsername) {
    try {
        const usersRef = collection(db, `artifacts/${appId}/users`);
        const lowerQuery = query(usersRef, where('usernameLower', '==', normalizedUsername));
        const lowerMatches = await getDocs(lowerQuery);
        if (!lowerMatches.empty) return lowerMatches.docs[0].id;

        const allUsers = await getDocs(usersRef);
        const matchingUser = allUsers.docs.find(userDoc => normalizeUsername(userDoc.data()?.username) === normalizedUsername);
        if (matchingUser) return matchingUser.id;
    } catch (error) {
        console.warn('Could not check legacy usernames before signup:', error);
    }

    return null;
}

async function reserveUsername(appId, userId, username, email) {
    const normalizedUsername = normalizeUsername(username);
    const legacyOwner = await findExistingUsernameOwner(appId, normalizedUsername);
    if (legacyOwner && legacyOwner !== userId) {
        throw new Error('That username is already taken.');
    }

    const usernameRef = doc(db, `artifacts/${appId}/usernames/${normalizedUsername}`);
    await runTransaction(db, async (transaction) => {
        const usernameSnap = await transaction.get(usernameRef);
        if (usernameSnap.exists() && usernameSnap.data()?.userId !== userId) {
            throw new Error('That username is already taken.');
        }

        transaction.set(usernameRef, {
            userId,
            username,
            usernameLower: normalizedUsername,
            email,
            updatedAt: new Date().toISOString()
        }, { merge: false });
    });
}

async function handleSignup(email, password, username) {
    const cleanUsername = validateUsername(username);
    const appId = getAppId();
    let user = null;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        await reserveUsername(appId, user.uid, cleanUsername, email);
        
        // Set display name
        await updateProfile(user, {
            displayName: cleanUsername,
            photoURL: `https://placehold.co/96x96/4f46e5/ffffff?text=${cleanUsername.charAt(0).toUpperCase()}`
        });
        
        return user;
    } catch (error) {
        if (user && error.message === 'That username is already taken.') {
            try {
                await deleteUser(user);
            } catch (deleteError) {
                console.error('Failed to roll back duplicate-username account:', deleteError);
            }
        }
        console.error('Signup error:', error);
        throw error;
    }
}

async function resolveUsernameToEmail(appId, input) {
    const trimmedInput = String(input || '').trim();

    // If it looks like an email (contains @), return as-is
    if (trimmedInput.includes('@')) {
        return trimmedInput;
    }

    // Otherwise treat it as a username and look it up
    const normalizedUsername = normalizeUsername(trimmedInput);
    try {
        const usernameRef = doc(db, `artifacts/${appId}/usernames/${normalizedUsername}`);
        const usernameDoc = await getDocs(query(collection(db, `artifacts/${appId}/usernames`), where('usernameLower', '==', normalizedUsername)));
        if (!usernameDoc.empty) {
            return usernameDoc.docs[0].data().email;
        }

        // Fallback: check users collection for legacy usernames
        const usersRef = collection(db, `artifacts/${appId}/users`);
        const userDocs = await getDocs(query(usersRef, where('usernameLower', '==', normalizedUsername)));
        if (!userDocs.empty) {
            return userDocs.docs[0].data().email;
        }

        throw new Error('Username not found.');
    } catch (error) {
        console.warn('Could not resolve username:', error);
        // If lookup fails, assume it's an email and let Firebase handle the error
        return trimmedInput;
    }
}

async function handleLogin(emailOrUsername, password) {
    try {
        const appId = getAppId();
        const email = await resolveUsernameToEmail(appId, emailOrUsername);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

async function handleForgotPassword(email) {
    try {
        const normalizedEmail = String(email || '').trim();
        if (!normalizedEmail) {
            throw new Error('Please enter your email first.');
        }
        await sendPasswordResetEmail(auth, normalizedEmail);
    } catch (error) {
        console.error('Forgot password error:', error);
        throw error;
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
}

async function updateUserProfile(userId, profileData) {
    try {
        const appId = getAppId();
        const username = validateUsername(profileData.username);
        await reserveUsername(appId, userId, username, profileData.email);
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
        await setDoc(userDocRef, {
            username,
            usernameLower: normalizeUsername(username),
            email: profileData.email,
            subscribed: profileData.subscribed,
            createdAt: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error('Update profile error:', error);
        throw error;
    }
}

function setupAuthStateListener(callback) {
    onAuthStateChanged(auth, user => {
        currentUser = user;
        callback(user);
    });
}

export {
    handleSignup,
    handleLogin,
    handleForgotPassword,
    handleLogout,
    updateUserProfile,
    setupAuthStateListener,
    currentUser
};
