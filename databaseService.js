// databaseService.js (Root File)
import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, persistentLocalCache, collection, 
  query, where, getDocs, limit, orderBy, startAfter 
} from "firebase/firestore";

const firebaseConfig = { /* Your Config Here */ };
const app = initializeApp(firebaseConfig);

// ACTION: Enable Persistence Globally (Saves reads on revisit)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache() 
});

/**
 * MASTER FETCH FUNCTION
 * Use this for ALL your tabs (Students, Tutors, Parents, etc.)
 */
export const getSmartBatch = async (collectionName, lastVisibleDoc = null) => {
  const colRef = collection(db, collectionName);
  
  // ACTION: Audit 300 -> 20 (Hardcoded here so you never have to edit tabs)
  let q = query(colRef, orderBy("createdAt", "desc"), limit(20));

  if (lastVisibleDoc) {
    q = query(colRef, orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(20));
  }

  // ACTION: Uses one-time getDocs (No more expensive real-time listeners)
  const snapshot = await getDocs(q);
  
  return {
    docs: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1]
  };
};

/**
 * GLOBAL 1-READ SEARCH
 */
export const findByEmail = async (collectionName, email) => {
  const q = query(collection(db, collectionName), where("email", "==", email), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.docs.length > 0 ? snapshot.docs[0].data() : null;
};
