// ============================================================
// core/firebase.js  —  single source for ALL Firebase imports
// To upgrade SDK: change the version string once here.
// ============================================================

export { auth, db } from '../firebaseConfig.js';

export {
    collection, getDocs, doc, getDoc, where, query, orderBy,
    Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc,
    limit, startAfter, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export { onAuthStateChanged, signOut }
    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
