import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile, deleteUser } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot, getDoc, getDocs, query, where, orderBy, limit, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Read config from global variable (injected at runtime)
let firebaseConfig = {};
try {
  firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {};
} catch (parseError) {
  console.error('[Firebase] Failed to parse __firebase_config:', parseError);
  console.warn('[Firebase] Proceeding with empty config. Auth and Firestore will be disabled.');
}

if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
  throw new Error('[Firebase] Missing Firebase config. Set window.__firebase_config in config.local.js or inject it before main.js loads.');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app, auth, db,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile, deleteUser,
  doc, setDoc, deleteDoc, collection, onSnapshot, getDoc, getDocs, query, where, orderBy, limit, runTransaction
};
