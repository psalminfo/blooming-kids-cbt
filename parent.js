import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";

const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const form = document.getElementById("parentForm");
const loading = document.getElementById("loading");
const downloadLink = document.getElementById("downloadLink");
const pdfLink = document.getElementById("pdfLink");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  if (!studentName || !parentEmail) return;

  loading.classList.remove("hidden");
  downloadLink.classList.add("hidden");

  try {
    await signInAnonymously(auth);
    const reportsRef = collection(db, "reports");
    const q = query(reportsRef, where("studentNameLower", "==", studentName), where("parentEmailLower", "==", parentEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("No report found for the provided name and email.");
      loading.classList.add("hidden");
      return;
    }

    const doc = querySnapshot.docs[0].data();
    const filePath = doc.pdfPath;
    const url = await getDownloadURL(storageRef(storage, filePath));

    pdfLink.href = url;
    loading.classList.add("hidden");
    downloadLink.classList.remove("hidden");

  } catch (error) {
    console.error("Error generating report:", error);
    alert("An error occurred while generating the report. Please try again.");
    loading.classList.add("hidden");
  }
});
