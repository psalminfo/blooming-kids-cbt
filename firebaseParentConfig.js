// firebaseParentConfig.js — uses v10.12.2 (modular and clean)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
  authDomain: "bloomingkidsassessment.firebaseapp.com",
  projectId: "bloomingkidsassessment",
  storageBucket: "bloomingkidsassessment.appspot.com",
  messagingSenderId: "238975054977",
  appId: "1:238975054977:web:87c70b4db044998a204980"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
